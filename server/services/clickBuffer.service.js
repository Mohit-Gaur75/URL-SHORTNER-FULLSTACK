const { getRedis } = require("../config/redis");

const PENDING_KEY = "clicks:pending";
const PROCESSING_KEY = "clicks:processing";

async function record(code) {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis
      .multi()
      .hincrby(PENDING_KEY, `n:${code}`, 1)
      .hset(PENDING_KEY, `t:${code}`, Date.now())
      .exec();
    return true;
  } catch {
    return false;
  }
}

function parse(fields) {
  const byCode = new Map();
  for (const [field, value] of Object.entries(fields)) {
    const code = field.slice(2);
    const entry = byCode.get(code) || { code, count: 0, lastClickedAt: null };
    if (field.startsWith("n:")) entry.count = Number(value);
    else entry.lastClickedAt = new Date(Number(value));
    byCode.set(code, entry);
  }
  return [...byCode.values()].filter((entry) => entry.count > 0);
}

async function loadBatch() {
  const redis = getRedis();
  if (!redis) return [];

  let fields = await redis.hgetall(PROCESSING_KEY);
  if (Object.keys(fields).length === 0) {
    try {
      await redis.rename(PENDING_KEY, PROCESSING_KEY);
    } catch (err) {
      if (/no such key/i.test(err.message)) return [];
      throw err;
    }
    fields = await redis.hgetall(PROCESSING_KEY);
  }
  return parse(fields);
}

async function clearBatch() {
  const redis = getRedis();
  if (redis) await redis.del(PROCESSING_KEY);
}

module.exports = { record, loadBatch, clearBatch };
