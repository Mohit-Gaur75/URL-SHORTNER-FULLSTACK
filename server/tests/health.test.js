// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../app");
const healthService = require("../services/health.service");
const { _setRedisClientForTesting } = require("../config/redis");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    );
  });
}

test("GET /api/health/live: returns 200 without checking external databases", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  const res = await fetch(`${base}/api/health/live`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, "ok");
  assert.ok(data.timestamp);
  assert.equal(typeof data.uptimeSeconds, "number");
});

test("GET /api/health/ready: returns 503 when database is disconnected", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  // In test environment, mongoose.connection.readyState is 0 (disconnected)
  const res = await fetch(`${base}/api/health/ready`);
  assert.equal(res.status, 503);

  const data = await res.json();
  assert.equal(data.status, "not_ready");
  assert.equal(data.checks.database.status, "disconnected");
});

test("GET /api/health: returns 200 diagnostic report with 'down' when database is disconnected", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, "down");
  assert.equal(data.service, "url-shortener");
  assert.ok(data.memory);
  assert.ok(data.memory.heapUsedMb > 0);
  assert.equal(data.checks.database.status, "disconnected");
});

test("GET /api/health/ready: returns 200 'ready' when database ping succeeds", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  // Mock mongoose connection to simulate an active database
  const origReadyState = mongoose.connection.readyState;
  const origDb = mongoose.connection.db;

  mongoose.connection.readyState = 1;
  mongoose.connection.db = {
    admin: () => ({
      ping: async () => ({ ok: 1 }),
    }),
  };

  t.after(() => {
    mongoose.connection.readyState = origReadyState;
    mongoose.connection.db = origDb;
  });

  const res = await fetch(`${base}/api/health/ready`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, "ready");
  assert.equal(data.checks.database.status, "connected");
  assert.ok(typeof data.checks.database.latencyMs === "number");
});

test("GET /api/health: returns 200 'ok' when database and redis are healthy", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  // Mock mongoose
  const origReadyState = mongoose.connection.readyState;
  const origDb = mongoose.connection.db;
  mongoose.connection.readyState = 1;
  mongoose.connection.db = {
    admin: () => ({
      ping: async () => ({ ok: 1 }),
    }),
  };

  // Mock Redis
  _setRedisClientForTesting({
    status: "ready",
    ping: async () => "PONG",
  });

  t.after(() => {
    mongoose.connection.readyState = origReadyState;
    mongoose.connection.db = origDb;
    _setRedisClientForTesting(null);
  });

  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, "ok");
  assert.equal(data.checks.database.status, "connected");
  assert.equal(data.checks.redis.status, "connected");
  assert.ok(typeof data.checks.redis.latencyMs === "number");
});

test("GET /api/health: returns 200 'degraded' when database is healthy but redis is disconnected", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  // Mock mongoose
  const origReadyState = mongoose.connection.readyState;
  const origDb = mongoose.connection.db;
  mongoose.connection.readyState = 1;
  mongoose.connection.db = {
    admin: () => ({
      ping: async () => ({ ok: 1 }),
    }),
  };

  // Mock Redis as disconnected
  _setRedisClientForTesting({
    status: "reconnecting",
    ping: async () => {
      throw new Error("Connection refused");
    },
  });

  t.after(() => {
    mongoose.connection.readyState = origReadyState;
    mongoose.connection.db = origDb;
    _setRedisClientForTesting(null);
  });

  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, "degraded");
  assert.equal(data.checks.database.status, "connected");
  assert.equal(data.checks.redis.status, "disconnected");
});

test("healthService.checkDatabase: handles database ping timeout", async (t) => {
  const origReadyState = mongoose.connection.readyState;
  const origDb = mongoose.connection.db;

  mongoose.connection.readyState = 1;
  mongoose.connection.db = {
    admin: () => ({
      ping: () => new Promise(() => {}), // Never resolves (simulating socket freeze)
    }),
  };

  t.after(() => {
    mongoose.connection.readyState = origReadyState;
    mongoose.connection.db = origDb;
  });

  const result = await healthService.checkDatabase();
  assert.equal(result.status, "error");
  assert.match(result.error, /timed out/);
});
