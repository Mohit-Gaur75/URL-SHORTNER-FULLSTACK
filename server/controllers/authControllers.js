const jwt = require("jsonwebtoken");
const User = require("../models/user");
const HttpError = require("../utils/HttpError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const toUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if ([name, email, password].some((v) => typeof v !== "string")) {
    throw new HttpError(400, "Name, email and password are required");
  }
  if (!name.trim() || name.trim().length > 50) {
    throw new HttpError(400, "Name must be 1–50 characters");
  }
  if (!EMAIL_RE.test(email.trim())) {
    throw new HttpError(400, "Enter a valid email address");
  }
  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, "Password must be 8–72 characters");
  }

  let user;
  try {
    user = await User.create({ name, email, password });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, "Email is already registered");
    throw err;
  }

  res.status(201).json({ token: signToken(user._id), user: toUser(user) });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    throw new HttpError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+password"
  );

  // Same message for "no such user" and "wrong password", so attackers
  // can't use the login form to discover which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, "Invalid email or password");
  }

  res.json({ token: signToken(user._id), user: toUser(user) });
};

exports.getMe = async (req, res) => {
  res.json({ user: toUser(req.user) }); // req.user is set by the protect middleware
};