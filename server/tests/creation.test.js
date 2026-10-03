// Run with: npm test
// Link creation logic: retries, collisions, reserved codes, idempotent replay.
// The database is replaced by mocks, so these run anywhere.
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");

const Url = require("../models/url.model");
const codes = require("../utils/shortCode");
const { createShortUrl, resolveShortCode } = require("../services/url.service");
const { AppError, ConflictError, NotFoundError } = require("../utils/errors");

const duplicateKey = (field = "shortCode") =>
  Object.assign(new Error(`E11000 duplicate key { ${field}: ... }`), {
    name: "MongoServerError", code: 11000, keyPattern: { [field]: 1 },
  });

const OWNER = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";
const URL1 = "https://example.com/a";

test("random code: a collision is retried with a NEW code", async (t) => {
  const tried = [];
  t.mock.method(Url, "create", async (doc) => {
    tried.push(doc.shortCode);
    if (tried.length <= 2) throw duplicateKey(); // the first two codes were taken
    return doc;
  });
  const { url, created } = await createShortUrl({ originalUrl: URL1 });
  assert.equal(created, true);
  assert.equal(tried.length, 3);
  assert.equal(new Set(tried).size, 3, "each retry must use a different code");
  assert.equal(url.shortCode, tried[2]);
});

test("random code: gives up after 5 collisions with a clear error", async (t) => {
  const create = t.mock.method(Url, "create", async () => { throw duplicateKey(); });
  await assert.rejects(createShortUrl({ originalUrl: URL1 }), (err) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.code, "CODE_GENERATION_FAILED");
    return true;
  });
  assert.equal(create.mock.callCount(), 5);
});

test("a database error that is NOT a code collision is never retried", async (t) => {
  const boom = Object.assign(new Error("disk on fire"), { name: "MongoServerError", code: 8000 });
  const create = t.mock.method(Url, "create", async () => { throw boom; });
  await assert.rejects(createShortUrl({ originalUrl: URL1 }), (err) => err === boom);
  assert.equal(create.mock.callCount(), 1);
});

test("a duplicate on some OTHER unique index is not mistaken for a code collision", async (t) => {
  const other = duplicateKey("someOtherField");
  const create = t.mock.method(Url, "create", async () => { throw other; });
  await assert.rejects(createShortUrl({ originalUrl: URL1 }), (err) => err === other);
  assert.equal(create.mock.callCount(), 1);
});

test("random code: a generated reserved word is thrown away, not used", async (t) => {
  const queue = ["Support", "LOGIN", "abc1234"];
  t.mock.method(codes, "generate", () => queue.shift());
  const create = t.mock.method(Url, "create", async (doc) => doc);
  const { url } = await createShortUrl({ originalUrl: URL1 });
  assert.equal(url.shortCode, "abc1234");
  assert.equal(create.mock.callCount(), 1); // reserved words didn't even cost an attempt
});

test("expiresAt and the owner are stored with the link", async (t) => {
  const create = t.mock.method(Url, "create", async (doc) => doc);
  const expiresAt = new Date(Date.now() + 86400000);
  await createShortUrl({ originalUrl: URL1, customCode: "my-link", expiresAt, userId: OWNER });
  const doc = create.mock.calls[0].arguments[0];
  assert.deepEqual(
    [doc.user, doc.shortCode, doc.isCustomAlias, doc.expiresAt],
    [OWNER, "my-link", true, expiresAt]
  );
});

// ---------------------------------------------------------------- custom aliases

const existingLink = (overrides = {}) => ({
  user: OWNER, shortCode: "my-link", originalUrl: URL1, expiresAt: null, status: "active", ...overrides,
});

async function claimAlias(t, existing, request = {}) {
  t.mock.method(Url, "create", async () => { throw duplicateKey(); });
  t.mock.method(Url, "findOne", async () => existing);
  return createShortUrl({ originalUrl: URL1, customCode: "my-link", userId: OWNER, ...request });
}

test("custom alias: never retried, an anonymous caller gets 409", async (t) => {
  const create = t.mock.method(Url, "create", async () => { throw duplicateKey(); });
  await assert.rejects(
    createShortUrl({ originalUrl: URL1, customCode: "my-link" }),
    (err) => err instanceof ConflictError && err.code === "SHORT_CODE_TAKEN"
  );
  assert.equal(create.mock.callCount(), 1);
});

test("custom alias: the SAME owner repeating the SAME request gets their link back (idempotent)", async (t) => {
  const existing = existingLink();
  const result = await claimAlias(t, existing);
  assert.equal(result.created, false);
  assert.equal(result.url, existing);
});

test("custom alias: same-request replay also needs the same expiry", async (t) => {
  const when = new Date(Date.now() + 86400000);
  const replay = await claimAlias(t, existingLink({ expiresAt: new Date(when) }), { expiresAt: new Date(when) });
  assert.equal(replay.created, false);
});

for (const [label, existing, request] of [
  ["owned by someone else", existingLink({ user: OTHER }), {}],
  ["same owner but a different destination", existingLink({ originalUrl: "https://example.com/other" }), {}],
  ["same owner but a different expiry", existingLink({ expiresAt: new Date(Date.now() + 86400000) }), {}],
  ["same owner, link was deleted (the code stays reserved)", existingLink({ status: "deleted" }), {}],
  ["existing link has no owner", existingLink({ user: null }), {}],
]) {
  test(`custom alias: 409 when the existing link is ${label}`, async (t) => {
    await assert.rejects(claimAlias(t, existing, request), (err) => err.code === "SHORT_CODE_TAKEN");
  });
}

// ---------------------------------------------------------------- redirect + expiry

test("redirect: an expired or unknown link is 'not found' and counts no click", async (t) => {
  // The database applies the expiry filter inside the atomic update; when
  // nothing matches it returns null.
  t.mock.method(Url, "findOneAndUpdate", async () => null);
  await assert.rejects(resolveShortCode("abc1234"), (err) => err instanceof NotFoundError && err.code === "URL_NOT_FOUND");
});
