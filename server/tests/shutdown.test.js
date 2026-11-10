// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const app = require("../app");
const { createGracefulShutdown } = require("../utils/gracefulShutdown");
const { setShuttingDown, getIsShuttingDown } = require("../services/health.service");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    );
  });
}

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

test("createGracefulShutdown: closes HTTP server and executes cleanup", async (t) => {
  const { server } = await listen();
  let customCleanupCalled = false;

  // Intercept process.exit so test process does not terminate
  const originalExit = process.exit;
  let exitCodeCalled = null;
  process.exit = (code) => {
    exitCodeCalled = code;
  };

  t.after(() => {
    process.exit = originalExit;
    setShuttingDown(false);
  });

  const shutdownCoordinator = createGracefulShutdown({
    server,
    logger: mockLogger,
    timeoutMs: 2000,
    onShutdown: async () => {
      customCleanupCalled = true;
    },
  });

  await shutdownCoordinator.shutdown("SIGTERM", 0);

  assert.equal(server.listening, false, "HTTP server listener must be closed");
  assert.equal(customCleanupCalled, true, "Custom onShutdown hook must execute");
  assert.equal(exitCodeCalled, 0, "Process exit code should be 0");
  assert.equal(getIsShuttingDown(), true, "System must be flagged as shutting down");
});

test("createGracefulShutdown: ignores duplicate shutdown calls", async (t) => {
  let shutdownInvocations = 0;
  const originalExit = process.exit;
  process.exit = () => {};

  t.after(() => {
    process.exit = originalExit;
    setShuttingDown(false);
  });

  const shutdownCoordinator = createGracefulShutdown({
    server: null,
    logger: mockLogger,
    onShutdown: async () => {
      shutdownInvocations++;
    },
  });

  // Call shutdown twice concurrently
  await Promise.all([
    shutdownCoordinator.shutdown("SIGTERM", 0),
    shutdownCoordinator.shutdown("SIGINT", 0),
  ]);

  assert.equal(shutdownInvocations, 1, "Cleanup must only be called once");
});

test("Readiness probe returns 503 'shutting_down' when system is draining", async (t) => {
  const { server, base } = await listen();
  t.after(() => {
    server.close();
    setShuttingDown(false);
  });

  setShuttingDown(true);

  const res = await fetch(`${base}/api/health/ready`);
  assert.equal(res.status, 503);

  const data = await res.json();
  assert.equal(data.status, "shutting_down");
  assert.equal(data.checks.database.status, "draining");
  assert.equal(data.checks.redis.status, "draining");
});
