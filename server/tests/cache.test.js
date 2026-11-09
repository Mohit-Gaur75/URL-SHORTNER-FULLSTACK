// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");

const Url = require("../models/url.model");
const { _setRedisClientForTesting } = require("../config/redis");
const linkCache = require("../services/linkCache.service");
const urlService = require("../services/url.service");

// In-memory fake Redis client matching ioredis methods used by linkCache
function createMockRedis() {
  const store = new Map();
  const ttls = new Map();

  return {
    store,
    ttls,
    async get(key) {
      if (!store.has(key)) return null;
      const expiry = ttls.get(key);
      if (expiry && expiry <= Date.now()) {
        store.delete(key);
        ttls.delete(key);
        return null;
      }
      return store.get(key);
    },
    async set(key, value, mode, ttlSeconds) {
      store.set(key, value);
      if (mode === "EX" && ttlSeconds) {
        ttls.set(key, Date.now() + ttlSeconds * 1000);
      }
      return "OK";
    },
    async del(key) {
      store.delete(key);
      ttls.delete(key);
      return 1;
    },
  };
}

test("Redis disabled: isEnabled is false and get/set are safe no-ops", async () => {
  _setRedisClientForTesting(null);
  assert.equal(linkCache.isEnabled(), false);
  assert.equal(await linkCache.get("code1"), null);
  await assert.doesNotReject(() => linkCache.set("code1", "https://example.com"));
  await assert.doesNotReject(() => linkCache.invalidate("code1"));
});

test("Redis enabled: Cache Miss -> MongoDB read -> Cache Populate -> Cache Hit", async (t) => {
  const mockRedis = createMockRedis();
  _setRedisClientForTesting(mockRedis);
  t.after(() => _setRedisClientForTesting(null));

  let dbQueries = 0;
  t.mock.method(Url, "findOne", async () => {
    dbQueries++;
    return {
      _id: "507f1f77bcf86cd799439011",
      originalUrl: "https://example.com/cached-dest",
      shortCode: "test1234",
      status: "active",
      expiresAt: null,
    };
  });
  t.mock.method(Url, "updateOne", async () => ({ acknowledged: true }));

  // Request 1: Cache Miss
  const dest1 = await urlService.resolveShortCode("test1234");
  assert.equal(dest1, "https://example.com/cached-dest");
  assert.equal(dbQueries, 1, "First request must query MongoDB");

  // Verify that Redis now contains the link
  const cachedRaw = await mockRedis.get(linkCache.keyFor("test1234"));
  assert.ok(cachedRaw, "Link must be stored in Redis");
  const parsed = JSON.parse(cachedRaw);
  assert.equal(parsed.u, "https://example.com/cached-dest");

  // Request 2: Cache Hit
  const dest2 = await urlService.resolveShortCode("test1234");
  assert.equal(dest2, "https://example.com/cached-dest");
  assert.equal(dbQueries, 1, "Second request must hit cache, not MongoDB");
});

test("Cache stampede protection: concurrent misses coalesce into ONE MongoDB query", async (t) => {
  const mockRedis = createMockRedis();
  _setRedisClientForTesting(mockRedis);
  t.after(() => _setRedisClientForTesting(null));

  let dbQueries = 0;
  t.mock.method(Url, "findOne", async () => {
    dbQueries++;
    // Simulate slight asynchronous database query latency
    await new Promise((r) => setTimeout(r, 20));
    return {
      _id: "507f1f77bcf86cd799439012",
      originalUrl: "https://example.com/stampede-dest",
      shortCode: "stamp123",
      status: "active",
      expiresAt: null,
    };
  });
  t.mock.method(Url, "updateOne", async () => ({ acknowledged: true }));

  // Fire 10 concurrent requests at the exact same instant
  const results = await Promise.all([
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
    urlService.resolveShortCode("stamp123"),
  ]);

  for (const dest of results) {
    assert.equal(dest, "https://example.com/stampede-dest");
  }
  assert.equal(dbQueries, 1, "All 10 concurrent requests must share exactly 1 DB query");
});

test("Cache invalidation: updateUrlFor purges the Redis cache key", async (t) => {
  const mockRedis = createMockRedis();
  _setRedisClientForTesting(mockRedis);
  t.after(() => _setRedisClientForTesting(null));

  const key = linkCache.keyFor("upd1234");
  await mockRedis.set(key, JSON.stringify({ u: "https://old.com", id: "1" }), "EX", 300);

  t.mock.method(Url, "findOneAndUpdate", async () => ({
    _id: "507f1f77bcf86cd799439013",
    shortCode: "upd1234",
    originalUrl: "https://new.com",
    status: "active",
  }));

  await urlService.updateUrlFor({ _id: "u1", role: "USER" }, "507f1f77bcf86cd799439013", {
    originalUrl: "https://new.com",
  });

  const remaining = await mockRedis.get(key);
  assert.equal(remaining, null, "Cache key must be purged after link update");
});

test("Cache invalidation: deleteUrlFor purges the Redis cache key", async (t) => {
  const mockRedis = createMockRedis();
  _setRedisClientForTesting(mockRedis);
  t.after(() => _setRedisClientForTesting(null));

  const key = linkCache.keyFor("del1234");
  await mockRedis.set(key, JSON.stringify({ u: "https://example.com", id: "1" }), "EX", 300);

  t.mock.method(Url, "findOneAndUpdate", async () => ({
    _id: "507f1f77bcf86cd799439014",
    shortCode: "del1234",
    status: "deleted",
  }));

  await urlService.deleteUrlFor({ _id: "u1", role: "USER" }, "507f1f77bcf86cd799439014");

  const remaining = await mockRedis.get(key);
  assert.equal(remaining, null, "Cache key must be purged after link deletion");
});

test("Fault tolerance: Redis read failure falls back transparently to MongoDB", async (t) => {
  const failingRedis = {
    async get() {
      throw new Error("ECONNREFUSED: Redis connection lost");
    },
    async set() {
      throw new Error("ECONNREFUSED");
    },
    async del() {},
  };
  _setRedisClientForTesting(failingRedis);
  t.after(() => _setRedisClientForTesting(null));

  let dbQueries = 0;
  t.mock.method(Url, "findOne", async () => {
    dbQueries++;
    return {
      _id: "507f1f77bcf86cd799439015",
      originalUrl: "https://example.com/fallback",
      shortCode: "err1234",
      status: "active",
      expiresAt: null,
    };
  });
  t.mock.method(Url, "updateOne", async () => ({ acknowledged: true }));

  // Must not throw an unhandled error; must fall back to DB
  const dest = await urlService.resolveShortCode("err1234");
  assert.equal(dest, "https://example.com/fallback");
  assert.equal(dbQueries, 1, "Must query DB when Redis fails");
});
