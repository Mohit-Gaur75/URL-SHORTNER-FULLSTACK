const mongoose = require("mongoose");
const { disconnectRedis } = require("../config/redis");
const { stopJobs } = require("../jobs");
const { setShuttingDown } = require("../services/health.service");

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Creates a graceful shutdown coordinator.
 *
 * @param {object} options
 * @param {import("http").Server} [options.server] - Active Node.js HTTP server (if running an HTTP API)
 * @param {object} options.logger - Structured logger instance
 * @param {number} [options.timeoutMs=10000] - Maximum time to wait before forcing termination
 * @param {Function} [options.onShutdown] - Additional custom cleanup hook
 */
function createGracefulShutdown({
  server = null,
  logger,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onShutdown = null,
}) {
  let isShuttingDown = false;

  async function shutdown(signal = "SIGTERM", exitCode = 0) {
    if (isShuttingDown) {
      logger.warn({ signal }, "Shutdown already in progress, ignoring duplicate signal");
      return;
    }
    isShuttingDown = true;

    // 1. Immediately fail readiness checks so load balancers divert new traffic
    setShuttingDown(true);
    logger.info({ signal }, "Graceful shutdown initiated, stopping new requests...");

    // 2. Set hard deadline to force exit if cleanup hangs
    const forceExitTimer = setTimeout(() => {
      logger.fatal(
        { timeoutMs },
        "Graceful shutdown timed out; forcing immediate process termination"
      );
      process.exit(1);
    }, timeoutMs);

    // Allow process to naturally exit if all event loop work finishes earlier
    if (forceExitTimer.unref) {
      forceExitTimer.unref();
    }

    try {
      // 3. Stop accepting new HTTP connections and drain active keep-alive sockets
      if (server && server.listening) {
        logger.info("Closing HTTP server listener...");
        await new Promise((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
        if (typeof server.closeIdleConnections === "function") {
          server.closeIdleConnections();
        }
        logger.info("HTTP server closed to new connections.");
      }

      // 4. Drain and stop BullMQ background workers
      logger.info("Stopping background queue workers...");
      await stopJobs();

      // 5. Run any custom shutdown tasks
      if (typeof onShutdown === "function") {
        await onShutdown();
      }

      // 6. Close Redis cache connection
      logger.info("Disconnecting Redis cache...");
      await disconnectRedis();

      // 7. Close MongoDB connection pool
      logger.info("Disconnecting MongoDB connection pool...");
      await mongoose.disconnect();

      clearTimeout(forceExitTimer);
      logger.info("All resources closed cleanly. Process exiting.");
      process.exit(exitCode);
    } catch (err) {
      clearTimeout(forceExitTimer);
      logger.fatal({ err }, "Error occurred during graceful shutdown");
      process.exit(1);
    }
  }

  function register() {
    process.on("SIGTERM", () => shutdown("SIGTERM", 0));
    process.on("SIGINT", () => shutdown("SIGINT", 0));

    process.on("uncaughtException", (err) => {
      logger.fatal({ err }, "Uncaught Exception detected; initiating emergency shutdown");
      shutdown("uncaughtException", 1);
    });

    process.on("unhandledRejection", (reason) => {
      logger.fatal({ err: reason }, "Unhandled Promise Rejection detected; initiating emergency shutdown");
      shutdown("unhandledRejection", 1);
    });
  }

  return {
    shutdown,
    register,
    isShuttingDown: () => isShuttingDown,
  };
}

module.exports = { createGracefulShutdown };
