const { getRedis } = require("../config/redis");
const env = require("../config/env");

// Version prefix allows schema changes without flushing Redis manually
const KEY_PREFIX = "url:v1:";
const keyFor = (code) => `${KEY_PREFIX}${code}`;

const isEnabled = () => getRedis() !== null;

// Throttled logging: log cache failures at most once per 10 seconds to avoid flooding logs
let lastWarned = 0;
function warn(operation, err) {
  const now = Date.now();
  if (now - lastWarned > 10_000) {
    lastWarned = now;
    console.warn(`[cache] ${operation} failed, falling back to MongoDB:`, err.message);
  }
}

/**
 * Retrieves a cached link by short code.
 * @param {string} code
 * @returns {Promise<{ originalUrl: string, id: string | null } | null>}
 */
async function get(code) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(keyFor(code));
    if (raw === null) return null;

    const { u, e, id } = JSON.parse(raw);

    // Safeguard: if server clock slightly drifts, never redirect via an expired link
    if (e !== null && e <= Date.now()) return null;

    return { originalUrl: u, id: id ?? null };
  } catch (err) {
    warn("get", err);
    return null;
  }
}

/**
 * Stores a live link in Redis with a TTL.
 * @param {string} code
 * @param {string} originalUrl
 * @param {Date | string | null} expiresAt
 * @param {string | null} id
 */
async function set(code, originalUrl, expiresAt = null, id = null) {
  const redis = getRedis();
  if (!redis) return;
  try {
    let ttl = env.cacheTtlSeconds;
    if (expiresAt) {
      // Never cache past the exact instant the link expires
      const secondsLeft = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (secondsLeft <= 0) return; // already expired
      ttl = Math.min(ttl, secondsLeft);
    }

    const value = JSON.stringify({
      u: originalUrl,
      id: id ? String(id) : null,
      e: expiresAt ? new Date(expiresAt).getTime() : null,
    });

    await redis.set(keyFor(code), value, "EX", ttl);
  } catch (err) {
    warn("set", err);
  }
}

/**
 * Purges a link from Redis.
 * Must be called whenever a link is updated, disabled, or soft-deleted.
 * @param {string} code
 */
async function invalidate(code) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(keyFor(code));
  } catch (err) {
    // The DB write already succeeded, so we don't throw an error to the user.
    // The TTL acts as a backstop guarantee.
    warn("invalidate", err);
  }
}

module.exports = { isEnabled, get, set, invalidate, keyFor };
