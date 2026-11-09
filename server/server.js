const env = require("./config/env"); // validates environment first; exits if invalid
const app = require("./app");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { startJobs } = require("./jobs");

async function start() {
  // Connect BEFORE accepting traffic, so no request ever hits a dead database
  await connectDB();
  connectRedis(); // not awaited on purpose: the server starts even if Redis is down

  if (env.jobsMode === "inline") {
    startJobs().catch((err) => console.error("❌ Failed to start background jobs:", err.message));
  }

  app.listen(env.port, () => {
    console.log(`🚀 Server running on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error("❌ Failed to start server:", err.message);
  process.exit(1);
});
