const jwt = require("jsonwebtoken");
const User = require("../models/user");
const HttpError = require("../utils/HttpError");

module.exports = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Not authenticated");
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET); // checks signature + expiry
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  // Re-load the user, so a deleted account can't keep using an old token
  const user = await User.findById(payload.id);
  if (!user) throw new HttpError(401, "Not authenticated");

  req.user = user;
  next();
};