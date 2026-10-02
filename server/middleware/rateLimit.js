const rateLimit = require("express-rate-limit");
const { RateLimitError } = require("../utils/errors");


// NOTE: values are unchanged from the original project; Phase 10 redesigns them.
exports.createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: new RateLimitError("Too many links created, please try again later"),
});

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: new RateLimitError("Too many attempts, please try again later"),
});
