const Redis = require("ioredis");
const env = require("./env");

let client = null;

const getRedis = () => client;

function connectRedis() {
  if (!env.redisUrl) {
    console.log("ℹ️  REDIS_URL not set: redirect caching is disabled");
    return null;
  }

  client = new Redis(env.redisUrl, {
    // Fail immediately if Redis is unreachable instead of queuing commands forever
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,

    // Fast timeouts so a stalled Redis never hangs HTTP redirects
    commandTimeout: 200,
    connectTimeout: 2000,

    // Exponential backoff reconnect: 200ms, 400ms, ... up to 5s
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });

  // Debounce connection errors so a persistent outage doesn't flood logs
  let lastLogged = 0;
  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastLogged > 10_000) {
      lastLogged = now;
      console.warn("[redis] connection problem:", err.message);
    }
  });

  client.on("ready", () => console.log("✅ Redis connected"));

  return client;
}

async function disconnectRedis() {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
    client = null;
  }
}

// Allows injecting a test mock in unit tests
function _setRedisClientForTesting(testClient) {
  client = testClient;
}

module.exports = { connectRedis, getRedis, disconnectRedis, _setRedisClientForTesting };
