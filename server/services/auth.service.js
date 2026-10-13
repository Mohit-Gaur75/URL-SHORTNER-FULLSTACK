const User = require("../models/user.model");
const password = require("../utils/password");
const tokens = require("../utils/tokens");
const sessions = require("./session.service");
const { ConflictError, AuthenticationError } = require("../utils/errors");

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

async function register({ name, email, password: plainPassword }) {
  let user;
  try {
    user = await User.create({ name, email, password: plainPassword });
  } catch (err) {
    if (err.code === 11000) throw new ConflictError("Email is already registered", "EMAIL_TAKEN");
    throw err;
  }
  return { user: toPublicUser(user), session: await sessions.startSession(user) };
}

async function login({ email, password: plainPassword }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");

  // ALWAYS run one bcrypt comparison, even when the email doesn't exist. Skipping
  // it would make "no such user" answer instantly and "wrong password" take a
  // quarter of a second, and that difference reveals which emails are registered.
  const passwordMatches = await password.verifyPassword(plainPassword, user?.password ?? password.DUMMY_HASH);

  // Same message for "no such user" and "wrong password"
  if (!user || !passwordMatches) {
    throw new AuthenticationError("Invalid email or password", "INVALID_CREDENTIALS");
  }
  return { user: toPublicUser(user), session: await sessions.startSession(user) };
}

async function refresh(rawRefreshToken) {
  const { user, session } = await sessions.rotateSession(rawRefreshToken);
  return { user: toPublicUser(user), session };
}

const logout = (rawRefreshToken) => sessions.endSession(rawRefreshToken);
const logoutEverywhere = (userId) => sessions.endAllSessions(userId);

// Turns an access token into a user document, or throws 401.
async function authenticateToken(token) {
  let payload;
  try {
    payload = tokens.verifyAccessToken(token); // signature, expiry, issuer, algorithm
  } catch (err) {
    // "expired" vs "invalid" lets a client decide whether to refresh the session
    // or send the user back to the login page.
    if (err.name === "TokenExpiredError") throw new AuthenticationError("Token has expired", "TOKEN_EXPIRED");
    throw new AuthenticationError("Invalid token", "INVALID_TOKEN");
  }

  // Load the user, so a deleted account can't keep using an old token
  const user = await User.findById(payload.sub);
  if (!user) throw new AuthenticationError("Not authenticated");

  // "Log out everywhere" raised the user's tokenVersion after this token was issued
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new AuthenticationError("Session was ended", "TOKEN_REVOKED");
  }
  return user;
}

module.exports = { register, login, refresh, logout, logoutEverywhere, authenticateToken, toPublicUser };
