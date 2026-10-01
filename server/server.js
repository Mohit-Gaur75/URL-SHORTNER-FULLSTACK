const env = require("./config/env"); // validates environment first; exits if invalid
const app = require("./app");
const connectDB = require("./config/db");

async function start() {
  // Connect BEFORE accepting traffic, so no request ever hits a dead database
  await connectDB();

  app.listen(env.port, () => {
    console.log(`🚀 Server running on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error("❌ Failed to start server:", err.message);
  process.exit(1);
});
