const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const ISSUER = "url-shortener";
const ALGORITHM = "HS256";

// ---- access tokens: short-lived JWTs ---------------------------------------
// A JWT is three base64 parts: header.payload.signature. The payload is only
// SIGNED, not encrypted: anyone can read it, nobody can change it. So it holds
// nothing secret: who the user is (sub) and which "version" of their sessions
// this belongs to (tv, bumped by "log out everywhere").
const signAccessToken = (user) =>
  jwt.sign({ tv: user.tokenVersion ?? 0 }, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: env.accessTokenExpiresIn,
    issuer: ISSUER,
    subject: String(user._id),
  });

// `algorithms` is pinned on purpose. Without it a token claiming `alg: none`
// ("no signature needed") could be accepted by a careless setup.
const verifyAccessToken = (token) =>
  jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM], issuer: ISSUER });

// ---- refresh tokens: random, opaque, stored only as a hash ------------------
// 32 random bytes = 256 bits. Not a JWT: it carries no data and can't be
// forged, guessed or decoded. Its only meaning is "a row with this hash exists".
const generateRefreshToken = () => crypto.randomBytes(32).toString("base64url");

// Plain SHA-256 is right here (it would be wrong for passwords): the input has
// 256 bits of randomness, so there is nothing to brute-force. We store the hash
// so a leaked database doesn't hand out working sessions.
const hashRefreshToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken };
