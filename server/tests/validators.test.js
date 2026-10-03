// Run with: npm test
// These tests need no database: they exercise the schemas directly.
process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");

const { registerBody, loginBody } = require("../validators/auth.validator");
const { createUrlBody, updateUrlBody } = require("../validators/url.validator");
const { idParams, paginationQuery } = require("../validators/common");
const { analyticsQuery } = require("../validators/analytics.validator");

const ok = (schema, input) => {
  const r = schema.safeParse(input);
  assert.ok(r.success, `expected valid, got: ${r.error?.issues.map((i) => i.message)}`);
  return r.data;
};
const bad = (schema, input, messagePart) => {
  const r = schema.safeParse(input);
  assert.ok(!r.success, `expected invalid for ${JSON.stringify(input)}`);
  if (messagePart) {
    const all = r.error.issues.map((i) => i.message).join(" | ");
    assert.ok(all.includes(messagePart), `"${all}" should include "${messagePart}"`);
  }
};

test("register: cleans and accepts valid input", () => {
  const data = ok(registerBody, { name: "  Mohit ", email: "  M@Test.COM ", password: "password123" });
  assert.deepEqual(data, { name: "Mohit", email: "m@test.com", password: "password123" });
});

test("register: rejects bad input", () => {
  bad(registerBody, {}, "Name is required");
  bad(registerBody, { name: "A", email: "nope", password: "password123" }, "valid email");
  bad(registerBody, { name: "A", email: "a@b.co", password: "short" }, "at least 8");
  bad(registerBody, { name: "x".repeat(51), email: "a@b.co", password: "password123" }, "50 characters");
  bad(registerBody, { name: "A", email: 5, password: "password123" }, "Email is required");
  bad(registerBody, [], "JSON object");
});

test("register: password limit counts bytes, not characters", () => {
  const emoji20 = "😀".repeat(20); // 20 characters but 80 bytes
  bad(registerBody, { name: "A", email: "a@b.co", password: emoji20 }, "72 bytes");
  ok(registerBody, { name: "A", email: "a@b.co", password: "a".repeat(72) });
});

test("register: unknown fields are rejected (mass assignment)", () => {
  bad(registerBody, { name: "A", email: "a@b.co", password: "password123", role: "ADMIN" }, "role");
});

test("login: is lenient so legacy accounts can still sign in", () => {
  const data = ok(loginBody, { email: " Old@Mail.C ", password: "whatever" });
  assert.equal(data.email, "old@mail.c"); // would fail registration's email rule
});

test("login: operator objects are rejected (NoSQL injection)", () => {
  bad(loginBody, { email: { $gt: "" }, password: { $gt: "" } }, "required");
  bad(loginBody, { email: "a@b.co", password: ["x"] }, "Password is required");
});

test("create url: normalizes and accepts", () => {
  const data = ok(createUrlBody, { originalUrl: "  https://Example.com  ", customCode: "" });
  assert.equal(data.originalUrl, "https://example.com/");
  assert.equal(data.customCode, undefined); // empty string means "none"
  assert.equal(ok(createUrlBody, { originalUrl: "https://a.com", customCode: "my-link_1" }).customCode, "my-link_1");
});

test("create url: rejects dangerous or invalid URLs", () => {
  bad(createUrlBody, {}, "URL is required");
  bad(createUrlBody, { originalUrl: "" }, "URL is required");
  bad(createUrlBody, { originalUrl: "not a url" }, "Invalid URL format");
  bad(createUrlBody, { originalUrl: "javascript:alert(1)" }, "http and https");
  bad(createUrlBody, { originalUrl: "ftp://example.com/file" }, "http and https");
  bad(createUrlBody, { originalUrl: "http://localhost:5000/abc" }, "link to this service");
  bad(createUrlBody, { originalUrl: "https://a.com/" + "x".repeat(2100) }, "too long");
  bad(createUrlBody, { originalUrl: { $ne: null } }, "URL is required");
});

test("create url: custom code rules", () => {
  bad(createUrlBody, { originalUrl: "https://a.com", customCode: "ab" }, "3–30");
  bad(createUrlBody, { originalUrl: "https://a.com", customCode: "has space" }, "3–30");
  bad(createUrlBody, { originalUrl: "https://a.com", customCode: "x".repeat(31) }, "3–30");
  bad(createUrlBody, { originalUrl: "https://a.com", customCode: "ADMIN" }, "reserved");
  bad(createUrlBody, { originalUrl: "https://a.com", customCode: 12345 }, "must be a string");
});

test("update url: needs at least one valid field", () => {
  bad(updateUrlBody, {}, "at least one field");
  ok(updateUrlBody, { status: "disabled" });
  bad(updateUrlBody, { status: "deleted" }, "'active' or 'disabled'");
  bad(updateUrlBody, { shortCode: "hijack" }, "shortCode"); // codes are immutable
  bad(updateUrlBody, { originalUrl: "ftp://x.com" }, "http and https");
});

test("update url: expiresAt must be a future date or null", () => {
  ok(updateUrlBody, { expiresAt: null });
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.ok(ok(updateUrlBody, { expiresAt: future }).expiresAt instanceof Date);
  bad(updateUrlBody, { expiresAt: "2020-01-01" }, "future");
  bad(updateUrlBody, { expiresAt: "tomorrow" }, "ISO date");
});

test("id param: must look like an ObjectId", () => {
  ok(idParams, { id: "507f1f77bcf86cd799439011" });
  bad(idParams, { id: "123" }, "Invalid id");
  bad(idParams, { id: "507f1f77bcf86cd79943901z" }, "Invalid id");
  bad(idParams, {}, "Invalid id");
});

test("pagination: defaults, coercion and bounds", () => {
  assert.deepEqual(ok(paginationQuery, {}), { page: 1, limit: 20 });
  assert.deepEqual(ok(paginationQuery, { page: "3", limit: "50" }), { page: 3, limit: 50 });
  bad(paginationQuery, { page: "0" }, "at least 1");
  bad(paginationQuery, { page: "abc" }, "must be a number");
  bad(paginationQuery, { page: "1.5" }, "whole number");
  bad(paginationQuery, { limit: "101" }, "at most 100");
  bad(paginationQuery, { limit: "-5" }, "at least 1");
  bad(paginationQuery, { page: ["1", "2"] }, "must be a number");
});

test("analytics filters", () => {
  assert.equal(ok(analyticsQuery, {}).interval, "day");
  const d = ok(analyticsQuery, { from: "2026-01-01", to: "2026-02-01T10:00:00Z", interval: "week" });
  assert.ok(d.from instanceof Date && d.to instanceof Date);
  bad(analyticsQuery, { from: "2026-02-01", to: "2026-01-01" }, "must not be after");
  bad(analyticsQuery, { from: "2024-01-01", to: "2026-01-01" }, "366 days");
  bad(analyticsQuery, { from: "yesterday" }, "ISO date");
  bad(analyticsQuery, { interval: "year" }, "interval must be one of");
});

test("create url: rejects credentials embedded in the URL", () => {
  bad(createUrlBody, { originalUrl: "https://paypal.com@evil.example/login" }, "username or password");
  bad(createUrlBody, { originalUrl: "https://user:secret@example.com/" }, "username or password");
  ok(createUrlBody, { originalUrl: "https://example.com/path@with-at-sign" }); // an @ in the path is fine
});

test("create url: expiresAt must be a future date within 5 years, or null", () => {
  const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();
  const base = { originalUrl: "https://example.com" };

  assert.ok(ok(createUrlBody, { ...base, expiresAt: inDays(30) }).expiresAt instanceof Date);
  assert.equal(ok(createUrlBody, { ...base, expiresAt: null }).expiresAt, null);
  assert.equal(ok(createUrlBody, base).expiresAt, undefined); // left out = never
  bad(createUrlBody, { ...base, expiresAt: "2020-01-01" }, "future");
  bad(createUrlBody, { ...base, expiresAt: inDays(6 * 365) }, "at most 5 years");
  bad(createUrlBody, { ...base, expiresAt: "next week" }, "ISO date");
  bad(createUrlBody, { ...base, expiresAt: 1893456000000 }, "ISO date"); // a raw timestamp number is not accepted
});

test("update url: shares the same expiry limits", () => {
  const farFuture = new Date(Date.now() + 6 * 365 * 86400000).toISOString();
  bad(updateUrlBody, { expiresAt: farFuture }, "at most 5 years");
});

test("reserved words are blocked in any letter case, including app routes", () => {
  for (const code of ["login", "Dashboard", "API", "SUPPORT", "www", "Privacy"]) {
    bad(createUrlBody, { originalUrl: "https://a.com", customCode: code }, "reserved");
  }
  ok(createUrlBody, { originalUrl: "https://a.com", customCode: "support-us" }); // only exact words are reserved
});
