const env = require("./config/env"); // validates environment first; exits if invalid
const app = require("./app");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { startJobs } = require("./jobs");
const logger = require("./config/logger");

async function start() {
  // Connect BEFORE accepting traffic, so no request ever hits a dead database
  await connectDB();
  connectRedis(); // not awaited on purpose: the server starts even if Redis is down

  if (env.jobsMode === "inline") {
    startJobs().catch((err) => logger.error({ err }, "Failed to start background jobs"));
  }

  app.listen(env.port, () => {
    logger.info(`🚀 Server running on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
