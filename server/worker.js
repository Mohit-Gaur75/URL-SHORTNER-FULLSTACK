const env = require("./config/env");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { startJobs } = require("./jobs");
const logger = require("./config/logger");
const { createGracefulShutdown } = require("./utils/gracefulShutdown");

async function start() {
  if (!env.redisUrl) {
    logger.fatal("REDIS_URL is required to run the worker");
    process.exit(1);
  }
  await connectDB();
  connectRedis();
  await startJobs();
  logger.info("🛠️  Worker running");

  const shutdownCoordinator = createGracefulShutdown({ server: null, logger });
  shutdownCoordinator.register();
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start worker");
  process.exit(1);
});
