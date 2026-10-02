// Run with: npm test
// Needs no database: it checks how every kind of failure is translated into
// the standard error response.
process.env.NODE_ENV = "test"; // silences error logging
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test"; // unreachable on purpose
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/user.model");
const app = require("../app");
const requestId = require("../middleware/requestId");
const notFound = require("../middleware/notFound");
const errorHandler = require("../middleware/errorHandler");
const { normalizeError } = require("../utils/normalizeError");
const errors = require("../utils/errors");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------- normalizeError

test("our own error classes keep their status and code", () => {
  const cases = [
    [new errors.ValidationError([{ field: "x", message: "bad" }]), 400, "VALIDATION_ERROR"],
    [new errors.AuthenticationError(), 401, "UNAUTHENTICATED"],
    [new errors.AuthenticationError("expired", "TOKEN_EXPIRED"), 401, "TOKEN_EXPIRED"],
    [new errors.AuthorizationError(), 403, "FORBIDDEN"],
    [new errors.NotFoundError(), 404, "NOT_FOUND"],
    [new errors.ConflictError("taken", "EMAIL_TAKEN"), 409, "EMAIL_TAKEN"],
    [new errors.RateLimitError(), 429, "RATE_LIMITED"],
  ];
  for (const [err, status, code] of cases) {
    const n = normalizeError(err);
    assert.equal(n.statusCode, status);
    assert.equal(n.code, code);
    assert.equal(n.isOperational, true);
  }
  assert.deepEqual(normalizeError(cases[0][0]).details, [{ field: "x", message: "bad" }]);
});

test("body-parser errors become 400 / 413", () => {
  const parse = Object.assign(new SyntaxError("Unexpected token"), {
    type: "entity.parse.failed", status: 400, statusCode: 400, expose: true,
  });
  const big = Object.assign(new Error("too large"), {
    type: "entity.too.large", status: 413, statusCode: 413, expose: true,
  });
  const charset = Object.assign(new Error("bad charset"), {
    type: "charset.unsupported", status: 415, statusCode: 415, expose: true,
  });
  assert.deepEqual(
    [normalizeError(parse).statusCode, normalizeError(parse).code], [400, "INVALID_JSON"]
  );
  assert.equal(normalizeError(parse).message.includes("Unexpected token"), false); // no parser internals
  assert.deepEqual(
    [normalizeError(big).statusCode, normalizeError(big).code], [413, "PAYLOAD_TOO_LARGE"]
  );
  assert.deepEqual(
    [normalizeError(charset).statusCode, normalizeError(charset).code], [415, "BAD_REQUEST"]
  );
});

test("invalid ObjectId (a real Mongoose CastError) becomes 400 INVALID_ID", async () => {
  let caught;
  try { await User.findById("not-an-object-id"); } catch (e) { caught = e; }
  const n = normalizeError(caught);
  assert.equal(n.statusCode, 400);
  assert.equal(n.code, "INVALID_ID");
  assert.deepEqual(n.details, [{ field: "_id", message: "Invalid value for '_id'" }]);
});

test("a real Mongoose ValidationError lists the failing fields", async () => {
  let caught;
  try { await new User({}).validate(); } catch (e) { caught = e; }
  const n = normalizeError(caught);
  assert.equal(n.statusCode, 400);
  assert.equal(n.code, "VALIDATION_ERROR");
  assert.deepEqual(n.details.map((d) => d.field).sort(), ["email", "name", "password"]);
});

test("duplicate key → 409, names the field but never leaks the value", () => {
  const dup = Object.assign(new Error('E11000 duplicate key ... { email: "secret@x.com" }'), {
    name: "MongoServerError", code: 11000,
    keyPattern: { email: 1 }, keyValue: { email: "secret@x.com" },
  });
  const n = normalizeError(dup);
  assert.equal(n.statusCode, 409);
  assert.equal(n.code, "DUPLICATE_KEY");
  assert.deepEqual(n.details, [{ field: "email", message: "Already in use" }]);
  assert.equal(JSON.stringify(n).includes("secret@x.com"), false);
});

test("database unreachable (real Mongoose errors) → 503", async () => {
  // 1. queries issued while there is no connection time out in the buffer
  mongoose.set("bufferTimeoutMS", 50);
  let buffering;
  try { await User.findOne({}); } catch (e) { buffering = e; }
  assert.equal(normalizeError(buffering).statusCode, 503);
  assert.equal(normalizeError(buffering).code, "DATABASE_UNAVAILABLE");

  // 2. connecting to a server that isn't there
  let refused;
  try {
    await mongoose.connect("mongodb://127.0.0.1:1/test", { serverSelectionTimeoutMS: 300 });
  } catch (e) { refused = e; }
  assert.equal(normalizeError(refused).statusCode, 503);
  await mongoose.disconnect().catch(() => {});
});

test("other database errors and unknown errors are 500 and leak nothing", () => {
  const dbErr = Object.assign(new Error("E.g. password=hunter2 in a connection string"), {
    name: "MongoServerError", code: 8000,
  });
  const n1 = normalizeError(dbErr);
  assert.deepEqual([n1.statusCode, n1.code, n1.isOperational], [500, "DATABASE_ERROR", false]);
  assert.equal(n1.message.includes("hunter2"), false);

  const n2 = normalizeError(new TypeError("Cannot read properties of undefined (reading 'x')"));
  assert.deepEqual([n2.statusCode, n2.code, n2.isOperational], [500, "INTERNAL_ERROR", false]);
  assert.equal(n2.message, "Something went wrong");

  // someone threw a string or null instead of an Error
  assert.equal(normalizeError("oops").code, "INTERNAL_ERROR");
  assert.equal(normalizeError(null).code, "INTERNAL_ERROR");
});

// ---------------------------------------------------------------- over HTTP

function listen(expressApp) {
  return new Promise((resolve) => {
    const server = expressApp.listen(0, () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    );
  });
}
const json = (res) => res.json();
const post = (base, path, body, raw) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });

function assertEnvelope(res, body, status, code) {
  assert.equal(res.status, status);
  assert.equal(body.success, false);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.ok(Array.isArray(body.error.details));
  assert.match(body.requestId, UUID);
  assert.equal(res.headers.get("x-request-id"), body.requestId); // header and body agree
}

test("the real app answers failures in the standard format", async (t) => {
  const { server, base } = await listen(app);
  t.after(() => server.close());

  await t.test("unknown route → 404 ROUTE_NOT_FOUND (was an HTML page)", async () => {
    const res = await fetch(base + "/api/does-not-exist");
    assertEnvelope(res, await json(res), 404, "ROUTE_NOT_FOUND");
  });

  await t.test("malformed JSON → 400 INVALID_JSON, no parser internals", async () => {
    const res = await post(base, "/api/auth/register", null, "{bad json");
    const body = await json(res);
    assertEnvelope(res, body, 400, "INVALID_JSON");
    assert.equal(JSON.stringify(body).includes("position"), false);
  });

  await t.test("body over 10kb → 413", async () => {
    const res = await post(base, "/api/urls", { originalUrl: "https://a.com/" + "x".repeat(11000) });
    assertEnvelope(res, await json(res), 413, "PAYLOAD_TOO_LARGE");
  });

  await t.test("validation failure → 400 with a details array", async () => {
    const res = await post(base, "/api/auth/register", { name: "A", email: "nope", password: "123" });
    const body = await json(res);
    assertEnvelope(res, body, 400, "VALIDATION_ERROR");
    assert.equal(body.error.message, "Invalid request");
    assert.deepEqual(body.error.details.map((d) => d.field), ["email", "password"]);
  });

  await t.test("no token → 401 UNAUTHENTICATED", async () => {
    const res = await fetch(base + "/api/auth/me");
    assertEnvelope(res, await json(res), 401, "UNAUTHENTICATED");
  });

  await t.test("garbage token → 401 INVALID_TOKEN", async () => {
    const res = await fetch(base + "/api/auth/me", { headers: { Authorization: "Bearer garbage" } });
    assertEnvelope(res, await json(res), 401, "INVALID_TOKEN");
  });

  await t.test("expired token → 401 TOKEN_EXPIRED", async () => {
    const old = jwt.sign({ id: "507f1f77bcf86cd799439011" }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await fetch(base + "/api/auth/me", { headers: { Authorization: `Bearer ${old}` } });
    assertEnvelope(res, await json(res), 401, "TOKEN_EXPIRED");
  });

  await t.test("every request gets a different request id", async () => {
    const a = await fetch(base + "/api/health");
    const b = await fetch(base + "/api/health");
    assert.notEqual(a.headers.get("x-request-id"), b.headers.get("x-request-id"));
  });

  // Keep this LAST: it uses up the (shared, in-memory) auth rate limit.
  await t.test("rate limit → 429 RATE_LIMITED in the standard format", async () => {
    let limited;
    for (let i = 0; i < 15 && !limited; i++) {
      const res = await post(base, "/api/auth/login", {}); // invalid on purpose: still counts
      if (res.status === 429) limited = { res, body: await json(res) };
    }
    assert.ok(limited, "never got rate limited");
    assertEnvelope(limited.res, limited.body, 429, "RATE_LIMITED");
  });
});

test("forbidden, bugs and 'headers already sent' behave correctly", async (t) => {
  // A tiny app that uses the same middleware but with routes that misbehave
  const mini = express();
  mini.use(requestId);
  mini.get("/forbidden", () => { throw new errors.AuthorizationError(); });
  mini.get("/bug", () => { throw new Error("secret internal detail: db password is hunter2"); });
  mini.get("/async-bug", async () => { throw new Error("async secret hunter2"); });
  mini.get("/half-sent", (req, res) => {
    res.write("partial");
    throw new Error("failed after the response started");
  });
  mini.use(notFound);
  mini.use(errorHandler);
  const { server, base } = await listen(mini);
  t.after(() => server.close());

  await t.test("authorization error → 403 FORBIDDEN", async () => {
    const res = await fetch(base + "/forbidden");
    assertEnvelope(res, await json(res), 403, "FORBIDDEN");
  });

  await t.test("a bug → generic 500, no message, no stack", async () => {
    for (const path of ["/bug", "/async-bug"]) {
      const res = await fetch(base + path);
      const body = await json(res);
      assertEnvelope(res, body, 500, "INTERNAL_ERROR");
      assert.equal(body.error.message, "Something went wrong");
      const text = JSON.stringify(body);
      assert.equal(text.includes("hunter2"), false);
      assert.equal(text.includes("stack"), false);
      assert.equal(text.includes(".js"), false); // no file paths
    }
  });

  await t.test("error after the response started doesn't crash the server", async () => {
    await fetch(base + "/half-sent").then((r) => r.text()).catch(() => {});
    const res = await fetch(base + "/forbidden"); // server is still alive
    assert.equal(res.status, 403);
  });
});
