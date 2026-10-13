const rateLimit = require("express-rate-limit");
const { RateLimitError } = require("../utils/errors");

// NOTE: limits are unchanged from the original project; Phase 10 redesigns them.
// `handler` runs when a client is over the limit. Passing the error to next()
// sends it through the same error handler as everything else, so a 429 has
// the standard error format too.
exports.createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(new RateLimitError("Too many links created, please try again later")),
});

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(new RateLimitError("Too many attempts, please try again later")),
});

// Refreshing happens on every page load and about every 15 minutes while someone
// is active, so it needs a much roomier limit than logging in. The token itself
// can't be guessed (256 random bits); this only protects the database from floods.
exports.refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(new RateLimitError("Too many requests, please try again later")),
});
