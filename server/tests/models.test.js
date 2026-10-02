// Run with: npm test
// No database needed: schema rules are checked in memory, and the ownership
// tests replace the database calls with mocks.
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const Url = require("../models/url.model");
const User = require("../models/user.model");
const app = require("../app");
const urlService = require("../services/url.service");

const validUrl = (extra = {}) => new Url({ originalUrl: "https://example.com", shortCode: "abc1234", ...extra });
const errorFields = (doc) => Object.keys(doc.validateSync()?.errors ?? {});

// ---------------------------------------------------------------- Url schema

test("Url: defaults for a freshly created link", () => {
  const url = validUrl();
  assert.equal(url.status, "active");
  assert.equal(url.clicks, 0);
  assert.equal(url.user, null);
  assert.equal(url.expiresAt, null);
  assert.equal(url.lastClickedAt, null);
  assert.equal(url.isCustomAlias, false);
  assert.equal(url.validateSync(), undefined);
});

test("Url: required fields and limits", () => {
  assert.deepEqual(errorFields(new Url({})).sort(), ["originalUrl", "shortCode"]);
  assert.deepEqual(errorFields(validUrl({ originalUrl: "https://a.com/" + "x".repeat(2100) })), ["originalUrl"]);
  assert.deepEqual(errorFields(validUrl({ clicks: -1 })), ["clicks"]);
});

test("Url: status must be active, disabled or deleted", () => {
  for (const status of ["active", "disabled", "deleted"]) assert.equal(validUrl({ status }).validateSync(), undefined);
  assert.deepEqual(errorFields(validUrl({ status: "archived" })), ["status"]);
});

test("Url: shortCode has a unique index, and neither it nor isCustomAlias can change", () => {
  const unique = Url.schema.indexes().find(([fields]) => fields.shortCode === 1);
  assert.ok(unique && unique[1].unique, "expected a unique index on shortCode");
  assert.equal(Url.schema.path("shortCode").options.immutable, true);
  assert.equal(Url.schema.path("isCustomAlias").options.immutable, true);
});

test("Url: createdAt/updatedAt are maintained by Mongoose", () => {
  assert.equal(Url.schema.options.timestamps, true);
  assert.ok(Url.schema.path("createdAt") && Url.schema.path("updatedAt"));
});

// ---------------------------------------------------------------- User schema

test("User: role defaults to USER and must be USER or ADMIN", () => {
  const base = { name: "A", email: "a@b.co", password: "password123" };
  assert.equal(new User(base).role, "USER");
  assert.equal(new User({ ...base, role: "ADMIN" }).validateSync(), undefined);
  assert.deepEqual(errorFields(new User({ ...base, role: "SUPERUSER" })), ["role"]);
});

test("User: email is unique, lowercased and trimmed; timestamps on", () => {
  const unique = User.schema.indexes().find(([fields]) => fields.email === 1);
  assert.ok(unique && unique[1].unique, "expected a unique index on email");
  assert.equal(new User({ name: "A", email: "  M@Test.COM ", password: "password123" }).email, "m@test.com");
  assert.equal(User.schema.options.timestamps, true);
});

// ---------------------------------------------------------------- ownership + clicks

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}
const createLink = (base, body, token) =>
  fetch(base + "/api/urls", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });

test("creating a link: anonymous, owned, and bad-token cases", async (t) => {
  const USER_ID = "507f1f77bcf86cd799439011";
  const created = [];
  t.mock.method(Url, "create", async (doc) => {
    created.push(doc);
    return { _id: "x1", clicks: 0, status: "active", expiresAt: null, lastClickedAt: null, createdAt: new Date(), updatedAt: new Date(), ...doc };
  });
  t.mock.method(User, "findById", async (id) => (id === USER_ID ? { _id: USER_ID } : null));

  const { server, base } = await listen();
  t.after(() => server.close());
  const token = jwt.sign({ id: USER_ID }, process.env.JWT_SECRET, { expiresIn: "1h" });

  await t.test("no token → created anonymously (user: null)", async () => {
    const res = await createLink(base, { originalUrl: "https://example.com/a" });
    assert.equal(res.status, 201);
    assert.equal(created.at(-1).user, null);
    assert.equal(created.at(-1).isCustomAlias, false);
  });

  await t.test("valid token → owned by that user; custom code flagged", async () => {
    const res = await createLink(base, { originalUrl: "https://example.com/b", customCode: "my-link" }, token);
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(created.at(-1).user, USER_ID);
    assert.equal(created.at(-1).isCustomAlias, true);
    assert.equal(body.isCustomAlias, true);
    assert.equal(body.status, "active"); // new fields are in the response
  });

  await t.test("bad token → 401, and nothing is created", async () => {
    const before = created.length;
    const res = await createLink(base, { originalUrl: "https://example.com/c" }, "garbage");
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, "INVALID_TOKEN");
    assert.equal(created.length, before);
  });
});

test("a click updates clicks + lastClickedAt but must NOT touch updatedAt", async (t) => {
  const mock = t.mock.method(Url, "findOneAndUpdate", async () => ({ originalUrl: "https://example.com" }));
  const destination = await urlService.resolveShortCode("abc1234");
  assert.equal(destination, "https://example.com");

  const [filter, update, options] = mock.mock.calls[0].arguments;
  assert.deepEqual(filter, { shortCode: "abc1234" });
  assert.deepEqual(update.$inc, { clicks: 1 });
  assert.ok(update.$set.lastClickedAt instanceof Date);
  assert.equal(options.timestamps, false); // without this, every click would bump updatedAt
});
