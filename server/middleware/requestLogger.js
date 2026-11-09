const logger = require("../config/logger");

/**
 * High-performance HTTP request logging middleware.
 * Attaches a child logger with requestId to req.log.
 * Captures request completion metrics (latency, status, ip) asynchronously on res 'finish'.
 */
function requestLogger(req, res, next) {
  // Attach child logger containing the request ID for easy correlation across layers
  req.log = logger.child({ requestId: req.id });

  const startNs = process.hrtime.bigint();

  res.on("finish", () => {
    const endNs = process.hrtime.bigint();
    const durationMs = Number(endNs - startNs) / 1e6;

    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl ? req.originalUrl.split("?")[0] : req.url,
      status: res.statusCode,
      latencyMs: Math.round(durationMs * 100) / 100, // round to 2 decimal places
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };

    if (res.statusCode >= 500) {
      req.log.error(logData, "HTTP request failed with server error");
    } else if (res.statusCode >= 400) {
      req.log.warn(logData, "HTTP request completed with client warning");
    } else {
      req.log.info(logData, "HTTP request completed");
    }
  });

  next();
}

module.exports = requestLogger;
