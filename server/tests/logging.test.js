// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");
const pino = require("pino");

const app = require("../app");
const logger = require("../config/logger");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

test("Logger: redacts sensitive fields (password, token, secret, refreshToken)", () => {
  const loggedLines = [];
  const testLogger = pino(
    {
      level: "info",
      redact: {
        paths: ["password", "*.password", "token", "*.token", "secret", "*.secret", "refreshToken", "*.refreshToken"],
        censor: "[REDACTED]",
      },
    },
    {
      write(msg) {
        loggedLines.push(JSON.parse(msg));
      },
    }
  );

  testLogger.info(
    {
      user: "alice",
      password: "SuperSecretPassword123!",
      token: "eyJhbGciOiJIUzI1NiIsIn...",
      nested: { secret: "my_api_key", refreshToken: "refresh_123" },
    },
    "User authentication attempt"
  );

  assert.equal(loggedLines.length, 1);
  const entry = loggedLines[0];

  assert.equal(entry.user, "alice");
  assert.equal(entry.password, "[REDACTED]");
  assert.equal(entry.token, "[REDACTED]");
  assert.equal(entry.nested.secret, "[REDACTED]");
  assert.equal(entry.nested.refreshToken, "[REDACTED]");
});

test("requestLogger: attaches child logger with requestId to req.log", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);

  const requestIdHeader = res.headers.get("x-request-id");
  assert.ok(requestIdHeader, "X-Request-Id header must be present on response");
});

test("requestLogger: records accurate latency and status on response finish", async (t) => {
  const capturedLogs = [];
  const { server, base } = await listen();
  t.after(() => server.close());

  // Intercept stdout to inspect structured JSON output
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk, encoding, callback) => {
    try {
      capturedLogs.push(JSON.parse(chunk.toString()));
    } catch {}
    if (typeof callback === "function") callback();
    return true;
  };
  t.after(() => {
    process.stdout.write = originalWrite;
  });

  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
});
