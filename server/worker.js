const env = require("./config/env");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { startJobs } = require("./jobs");

async function start() {
  if (!env.redisUrl) {
    console.error("❌ REDIS_URL is required to run the worker");
    process.exit(1);
  }
  await connectDB();
  connectRedis();
  await startJobs();
  console.log("🛠️  Worker running");
}

start().catch((err) => {
  console.error("❌ Failed to start worker:", err.message);
  process.exit(1);
});
