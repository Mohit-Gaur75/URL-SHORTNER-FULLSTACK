const logger = require("../config/logger");
const { normalizeError } = require("../utils/normalizeError");

function logError(req, normalized, err) {
  const log = req?.log || logger;
  const context = {
    requestId: req?.id,
    method: req?.method,
    path: req?.originalUrl ? req.originalUrl.split("?")[0] : undefined,
    status: normalized.statusCode,
    code: normalized.code,
  };

  if (normalized.statusCode >= 500) {
    log.error({ ...context, err }, "Internal server error occurred");
  } else {
    log.warn({ ...context, message: normalized.message }, "Client request error");
  }
}

module.exports = (err, req, res, next) => {
  // If the response already started, hand over to Express to close the socket
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
    requestId: req?.id,
  });
};
