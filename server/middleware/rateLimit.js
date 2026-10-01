const rateLimit = require("express-rate-limit");

exports.createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 30 link creations per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many links created, please try again later" },
});

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});