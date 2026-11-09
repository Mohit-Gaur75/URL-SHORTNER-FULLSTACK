// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");

const app = require("../app");
const { sanitizeObject } = require("../middleware/sanitize");
const preventHpp = require("../middleware/preventHpp");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

test("sanitizeObject: strips NoSQL injection operator keys ($gt, $ne, $where)", () => {
  const maliciousInput = {
    email: "normal@example.com",
    password: { $ne: null },
    nested: {
      $where: "sleep(5000)",
      validKey: "ok",
      "dotted.key": "bad",
    },
  };

  const clean = sanitizeObject(maliciousInput);
  assert.equal(clean.email, "normal@example.com");
  assert.equal(clean.password.$ne, undefined);
  assert.deepEqual(clean.password, {});
  assert.equal(clean.nested.$where, undefined);
  assert.equal(clean.nested["dotted.key"], undefined);
  assert.equal(clean.nested.validKey, "ok");
});

test("sanitizeObject: strips prototype pollution attempts (__proto__, constructor)", () => {
  const payload = JSON.parse('{"__proto__":{"polluted":"yes"},"name":"clean"}');
  const clean = sanitizeObject(payload);
  assert.equal(Object.prototype.hasOwnProperty.call(clean, "__proto__"), false);
  assert.equal(clean.name, "clean");
  assert.equal({}.polluted, undefined, "Object prototype must not be polluted");
});

test("preventHpp: normalizes duplicated query parameters to single values", () => {
  const req = {
    query: {
      sort: ["createdAt", "clicks"],
      page: "2",
    },
  };
  const res = {};
  let nextCalled = false;

  preventHpp(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.query.sort, "clicks", "Repeated query param should collapse to last value");
  assert.equal(req.query.page, "2");
});

test("Security Headers: Helmet policies present on HTTP responses", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);

  // Security headers verified
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.ok(res.headers.get("content-security-policy"), "CSP header must be present");
  assert.ok(res.headers.get("x-request-id"), "X-Request-Id must be set");
});

test("CORS: blocks unconfigured origins or applies proper credentials policy", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  const res = await fetch(`${base}/api/health`, {
    headers: { Origin: "http://localhost:5173" },
  });

  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
});

test("Payload Size Limit: requests exceeding 10KB are rejected with 413", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  const oversizedBody = JSON.stringify({ data: "a".repeat(15 * 1024) }); // 15KB

  const res = await fetch(`${base}/api/urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: oversizedBody,
  });

  assert.equal(res.status, 413);
  const body = await res.json();
  assert.equal(body.error.code, "PAYLOAD_TOO_LARGE");
});
