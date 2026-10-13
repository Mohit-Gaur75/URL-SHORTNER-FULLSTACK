const mongoose = require("mongoose");
const env = require("../config/env");
const RefreshToken = require("../models/refreshToken.model");
const User = require("../models/user.model");
const tokens = require("../utils/tokens");
const { AuthenticationError } = require("../utils/errors");

const DAY_MS = 24 * 60 * 60 * 1000;

// Hands out a new access token AND a new refresh token.
// `family` is passed when we are continuing an existing login (a refresh);
// a brand-new login starts a brand-new family.
async function startSession(user, family = new mongoose.Types.ObjectId()) {
  const refreshToken = tokens.generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.refreshTokenDays * DAY_MS);

  await RefreshToken.create({
    user: user._id,
    tokenHash: tokens.hashRefreshToken(refreshToken), // the raw token is never stored
    family,
    expiresAt: refreshExpiresAt,
  });

  return { accessToken: tokens.signAccessToken(user), refreshToken, refreshExpiresAt };
}

// Trades a refresh token for a new pair. Every refresh token works ONCE.
async function rotateSession(rawToken) {
  const tokenHash = tokens.hashRefreshToken(rawToken);
  const now = new Date();

  // "Use up" the token. One atomic operation: find a token that is neither used
  // nor expired AND mark it used. If two requests present the same token at the
  // same instant, only one of them can match.
  const used = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
    { lean: true } // gives back the row as it was before: we need its user and family
  );

  if (used) {
    const user = await User.findById(used.user);
    if (!user) throw new AuthenticationError("Account no longer exists", "INVALID_REFRESH_TOKEN");
    return { user, session: await startSession(user, used.family) };
  }

  throw await explainRejection(tokenHash, now);
}

// The token didn't work. Why? The answer matters: one of these means "someone
// stole this token".
async function explainRejection(tokenHash, now) {
  const row = await RefreshToken.findOne(
    { tokenHash },
    { family: 1, user: 1, revokedAt: 1, expiresAt: 1 },
    { lean: true }
  );

  if (!row) return new AuthenticationError("Invalid refresh token", "INVALID_REFRESH_TOKEN");

  if (row.revokedAt) {
    // Used (or logged out) already. Two honest causes:
    //  - a race: two browser tabs refreshed at the same moment. Harmless.
    //  - theft: an attacker is replaying a token the real user already used.
    // Time tells them apart.
    if (now - row.revokedAt <= env.refreshReuseGraceSeconds * 1000) {
      return new AuthenticationError("Refresh token was just used, try again", "INVALID_REFRESH_TOKEN");
    }
    await RefreshToken.updateMany({ family: row.family, revokedAt: null }, { $set: { revokedAt: now } });
    if (env.nodeEnv !== "test") {
      console.warn("[security] refresh token reuse detected; session family revoked", {
        user: String(row.user),
        family: String(row.family),
      });
    }
    return new AuthenticationError("Session is no longer valid. Please sign in again.", "REFRESH_TOKEN_REUSED");
  }

  return new AuthenticationError("Session expired. Please sign in again.", "REFRESH_TOKEN_EXPIRED");
}

// Logout on THIS device: kill the whole family this token belongs to.
// Always succeeds, even for a token we don't recognize: logging out twice is fine.
async function endSession(rawToken) {
  const row = await RefreshToken.findOne({ tokenHash: tokens.hashRefreshToken(rawToken) }, { family: 1 }, { lean: true });
  if (!row) return;
  await RefreshToken.updateMany({ family: row.family, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

// Logout everywhere: revoke every refresh token of this user, and raise
// tokenVersion so access tokens already in circulation stop working at once.
async function endAllSessions(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

module.exports = { startSession, rotateSession, endSession, endAllSessions };
