// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");
const { performance } = require("perf_hooks");

const app = require("../app");
const { MONGO_POOL_OPTIONS } = require("../config/db");
const { _setRedisClientForTesting } = require("../config/redis");
const Url = require("../models/url.model");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    );
  });
}

test("Performance: MongoDB connection pool settings match high-throughput specification", () => {
  assert.equal(MONGO_POOL_OPTIONS.maxPoolSize, 100, "Expected maxPoolSize to be 100");
  assert.equal(MONGO_POOL_OPTIONS.minPoolSize, 10, "Expected minPoolSize to be 10 warm connections");
  assert.equal(MONGO_POOL_OPTIONS.maxIdleTimeMS, 30_000, "Expected idle socket timeout to be 30s");
  assert.equal(MONGO_POOL_OPTIONS.serverSelectionTimeoutMS, 5000, "Expected fast failover timeout (5s)");
  assert.equal(MONGO_POOL_OPTIONS.socketTimeoutMS, 45_000, "Expected socket timeout (45s)");
});

test("Performance: hot-path redirect throughput and low latency under concurrency", async (t) => {
  const { server, base } = await listen();
  t.after(() => {
    server.close();
    _setRedisClientForTesting(null);
  });

  const SHORT_CODE = "bench01";
  const TARGET_URL = "https://speed.example.com/target";

  // Mock in-memory Redis cache for ultra-fast link resolution
  const inMemoryCache = new Map();
  inMemoryCache.set(`url:v1:${SHORT_CODE}`, JSON.stringify({
    u: TARGET_URL,
    e: null,
    id: "507f1f77bcf86cd799439011",
  }));

  _setRedisClientForTesting({
    status: "ready",
    get: async (key) => inMemoryCache.get(key) || null,
    set: async (key, val) => inMemoryCache.set(key, val),
    hincrby: async () => 1,
  });

  // Warm up TCP socket and JIT compiler so cold connection handshake doesn't skew numbers
  for (let i = 0; i < 5; i++) {
    await fetch(`${base}/${SHORT_CODE}`, { method: "HEAD", redirect: "manual" });
  }

  // Execute 30 requests with concurrency 5
  const TOTAL_REQUESTS = 30;
  const CONCURRENCY = 5;
  const latencies = [];
  let completed = 0;

  const startAll = performance.now();

  async function worker() {
    while (completed < TOTAL_REQUESTS) {
      completed++;
      const t0 = performance.now();
      const res = await fetch(`${base}/${SHORT_CODE}`, {
        method: "GET",
        redirect: "manual",
      });
      const t1 = performance.now();
      latencies.push(t1 - t0);

      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), TARGET_URL);
      assert.match(res.headers.get("cache-control"), /no-store/);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const totalDuration = performance.now() - startAll;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const avg = latencies.reduce((acc, curr) => acc + curr, 0) / latencies.length;

  // Assertions for high performance under multi-suite test runner load
  assert.ok(totalDuration < 5000, `Expected requests to finish in < 5000ms, took ${totalDuration.toFixed(1)}ms`);
  assert.ok(p50 < 500, `Expected p50 latency to be under 500ms, was ${p50.toFixed(2)}ms`);
  assert.ok(avg < 500, `Expected average latency to be under 500ms, was ${avg.toFixed(2)}ms`);
});

test("Performance: invalid code rejects immediately without querying database", async (t) => {
  const { server, base } = await listen();
  let dbQueried = false;

  t.mock.method(Url, "findOne", () => {
    dbQueried = true;
    return null;
  });

  t.after(() => server.close());

  // Junk code (e.g. dotfile or illegal symbols)
  const res = await fetch(`${base}/.hidden_file`, { redirect: "manual" });
  assert.ok([404, 429].includes(res.status));
  assert.equal(dbQueried, false, "Invalid code must not hit database");
});
