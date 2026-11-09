// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");

const Url = require("../models/url.model");
const { _setRedisClientForTesting } = require("../config/redis");
const clickBuffer = require("../services/clickBuffer.service");
const { flushClicks } = require("../jobs/clickFlush.job");

function createMockRedis() {
  const hashes = new Map();

  return {
    hashes,
    multi() {
      const operations = [];
      const chain = {
        hincrby(key, field, amount) {
          operations.push(() => {
            const hash = hashes.get(key) || {};
            hash[field] = (Number(hash[field]) || 0) + amount;
            hashes.set(key, hash);
          });
          return chain;
        },
        hset(key, field, value) {
          operations.push(() => {
            const hash = hashes.get(key) || {};
            hash[field] = value;
            hashes.set(key, hash);
          });
          return chain;
        },
        async exec() {
          for (const op of operations) op();
          return ["OK", "OK"];
        },
      };
      return chain;
    },
    async hgetall(key) {
      return hashes.get(key) || {};
    },
    async rename(oldKey, newKey) {
      if (!hashes.has(oldKey)) {
        throw new Error("ERR no such key");
      }
      hashes.set(newKey, hashes.get(oldKey));
      hashes.delete(oldKey);
      return "OK";
    },
    async del(key) {
      hashes.delete(key);
      return 1;
    },
  };
}

test("clickBuffer: returns false when Redis is disabled", async () => {
  _setRedisClientForTesting(null);
  const recorded = await clickBuffer.record("xyz123");
  assert.equal(recorded, false);
});

test("clickBuffer: buffers clicks in memory hash and loads batch atomically", async (t) => {
  const mockRedis = createMockRedis();
  _setRedisClientForTesting(mockRedis);
  t.after(() => _setRedisClientForTesting(null));

  // Record 3 clicks on 'linkA' and 2 clicks on 'linkB'
  await clickBuffer.record("linkA");
  await clickBuffer.record("linkA");
  await clickBuffer.record("linkB");
  await clickBuffer.record("linkA");
  await clickBuffer.record("linkB");

  const batch = await clickBuffer.loadBatch();
  assert.equal(batch.length, 2);

  const linkA = batch.find((item) => item.code === "linkA");
  const linkB = batch.find((item) => item.code === "linkB");

  assert.equal(linkA.count, 3);
  assert.ok(linkA.lastClickedAt instanceof Date);
  assert.equal(linkB.count, 2);
  assert.ok(linkB.lastClickedAt instanceof Date);

  // Clear batch
  await clickBuffer.clearBatch();
  const remaining = await mockRedis.hgetall(clickBuffer.PROCESSING_KEY);
  assert.deepEqual(remaining, {});
});

test("flushClicks: executes atomic bulkWrite and clears the batch", async (t) => {
  const mockRedis = createMockRedis();
  _setRedisClientForTesting(mockRedis);
  t.after(() => _setRedisClientForTesting(null));

  await clickBuffer.record("batchCode1");
  await clickBuffer.record("batchCode1");
  await clickBuffer.record("batchCode2");

  let bulkOps = null;
  let bulkOptions = null;
  t.mock.method(Url, "bulkWrite", async (ops, options) => {
    bulkOps = ops;
    bulkOptions = options;
    return { ok: 1 };
  });

  const result = await flushClicks();
  assert.equal(result.flushed, 2);
  assert.equal(bulkOps.length, 2);
  assert.deepEqual(bulkOptions, { ordered: false, timestamps: false });

  // Verify the operations match what MongoDB expects
  const op1 = bulkOps.find((op) => op.updateOne.filter.shortCode === "batchCode1");
  assert.equal(op1.updateOne.update.$inc.clicks, 2);
  assert.ok(op1.updateOne.update.$max.lastClickedAt instanceof Date);

  const op2 = bulkOps.find((op) => op.updateOne.filter.shortCode === "batchCode2");
  assert.equal(op2.updateOne.update.$inc.clicks, 1);

  // Processing batch is now cleared
  const processing = await mockRedis.hgetall(clickBuffer.PROCESSING_KEY);
  assert.deepEqual(processing, {});
});

test("flushClicks: no-op when no clicks are pending", async (t) => {
  const mockRedis = createMockRedis();
  _setRedisClientForTesting(mockRedis);
  t.after(() => _setRedisClientForTesting(null));

  let bulkWriteCalled = false;
  t.mock.method(Url, "bulkWrite", async () => {
    bulkWriteCalled = true;
  });

  const result = await flushClicks();
  assert.equal(result.flushed, 0);
  assert.equal(bulkWriteCalled, false);
});
