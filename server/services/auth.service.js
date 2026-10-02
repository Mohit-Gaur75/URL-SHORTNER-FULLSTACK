const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/user.model");
const { ConflictError, AuthenticationError } = require("../utils/errors");

const signToken = (userId) =>
  jwt.sign({ id: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

async function register({ name, email, password }) {
  let user;
  try {
    user = await User.create({ name, email, password });
  } catch (err) {
    if (err.code === 11000) throw new ConflictError("Email is already registered", "EMAIL_TAKEN");
    throw err;
  }
  return { token: signToken(user._id), user: toPublicUser(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+password"
  );

  // Same message for "no such user" and "wrong password", so attackers
  // can't use the login form to discover which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
    throw new AuthenticationError("Invalid email or password", "INVALID_CREDENTIALS");
  }
  return { token: signToken(user._id), user: toPublicUser(user) };
}

// Turns a raw JWT into a user document, or throws 401.
async function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret); // checks signature + expiry
  } catch (err) {
    // Distinguishing "expired" from "invalid" lets a client know whether to
    // refresh the session or send the user back to the login page.
    if (err.name === "TokenExpiredError") {
      throw new AuthenticationError("Token has expired", "TOKEN_EXPIRED");
    }
    throw new AuthenticationError("Invalid token", "INVALID_TOKEN");
  }

  // Re-load the user, so a deleted account can't keep using an old token
  const user = await User.findById(payload.id);
  if (!user) throw new AuthenticationError("Not authenticated");
  return user;
}

module.exports = { register, login, authenticateToken, toPublicUser };
