const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/user.model");
const HttpError = require("../utils/HttpError");

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
    if (err.code === 11000) throw new HttpError(409, "Email is already registered");
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
    throw new HttpError(401, "Invalid email or password");
  }
  return { token: signToken(user._id), user: toPublicUser(user) };
}

// Turns a raw JWT into a user document, or throws 401.
async function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret); // checks signature + expiry
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  // Re-load the user, so a deleted account can't keep using an old token
  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

module.exports = { register, login, authenticateToken, toPublicUser };
