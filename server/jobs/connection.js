const IORedis = require("ioredis");
const env = require("../config/env");

function createConnection() {
  const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  connection.on("error", (err) => console.warn("[jobs] redis connection problem:", err.message));
  return connection;
}

module.exports = { createConnection };
