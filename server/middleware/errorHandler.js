const env = require("../config/env");
const { normalizeError } = require("../utils/normalizeError");

// Interim logging; Phase 17 replaces this with structured logging.
// We log method + path (without the query string, which can carry tokens)
// and NEVER the request body, headers or password fields.
function logError(req, normalized, err) {
  if (env.nodeEnv === "test") return;

  const entry = JSON.stringify({
    requestId: req.id,
    method: req.method,
    path: req.originalUrl.split("?")[0],
    status: normalized.statusCode,
    code: normalized.code,
  });

  if (normalized.statusCode >= 500) {
    console.error("[error]", entry, "\n", err); // full stack: this is for us, not the client
  } else {
    console.warn("[warn]", entry, normalized.message);
  }
}

// Express recognizes error middleware by its FOUR parameters, so keep `next`.
module.exports = (err, req, res, next) => {
  // If the response already started, we can't send a clean JSON error anymore.
  // Hand over to Express, which will close the connection.
  if (res.headersSent) return next(err);

  const normalized = normalizeError(err);
  logError(req, normalized, err);

  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    },
    requestId: req.id,
  });
};
