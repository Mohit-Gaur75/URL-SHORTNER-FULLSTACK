// Run with: npm test
// The redirect engine: which answer each kind of link gets, how many database
// round trips it costs, and the HTTP details (status code, caching, HEAD).
// The database is replaced by mocks, so these run anywhere.
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");

const Url = require("../models/url.model");
const app = require("../app");
const { resolveShortCode } = require("../services/url.service");
const { GoneError, NotFoundError } = require("../utils/errors");

const PAST = new Date(Date.now() - 60000);
const FUTURE = new Date(Date.now() + 3600000);

// Pretends the database holds ONE link. `matches` decides whether the atomic
// "live link" query finds it; `row` is what the follow-up "why not?" read sees.
function fakeDatabase(t, { live, row }) {
  const update = t.mock.method(Url, "findOneAndUpdate", async () => (live ? { originalUrl: "https://example.com/dest" } : null));
  const read = t.mock.method(Url, "findOne", async (filter) =>
    // the first form of findOne is the read-only live lookup (HEAD); the second is the "why" read
    "status" in filter ? (live ? { originalUrl: "https://example.com/dest" } : null) : row
  );
  return { update, read };
}

// ---------------------------------------------------------------- the hot path

test("live link: ONE database call, a click is counted, plain objects are used", async (t) => {
  const { update, read } = fakeDatabase(t, { live: true });
  const destination = await resolveShortCode("abc1234");

  assert.equal(destination, "https://example.com/dest");
  assert.equal(update.mock.callCount(), 1);
  assert.equal(read.mock.callCount(), 0, "the slow-path read must not run for a live link");

  const [filter, change, options] = update.mock.calls[0].arguments;
  assert.equal(filter.shortCode, "abc1234");
  assert.deepEqual(filter.status, { $in: ["active", null] }); // allow-list, incl. pre-status documents
  assert.deepEqual(filter.$or[0], { expiresAt: null });
  assert.ok(filter.$or[1].expiresAt.$gt instanceof Date);
  assert.deepEqual(change.$inc, { clicks: 1 });
  assert.ok(change.$set.lastClickedAt instanceof Date);
  assert.equal(options.timestamps, false); // a click is not an "edit"
  assert.equal(options.lean, true); //         no full Mongoose document on the hot path
});

test("junk codes never reach the database", async (t) => {
  const { update, read } = fakeDatabase(t, { live: true });
  for (const junk of ["favicon.ico", "a", "has space", "x".repeat(31), "../etc/passwd"]) {
    await assert.rejects(resolveShortCode(junk), (err) => err instanceof NotFoundError && err.code === "URL_NOT_FOUND");
  }
  assert.equal(update.mock.callCount() + read.mock.callCount(), 0);
});

// ---------------------------------------------------------------- why a link isn't followed

const cases = [
  ["does not exist", null, 404, "URL_NOT_FOUND"],
  ["is disabled by its owner", { status: "disabled", expiresAt: null }, 404, "LINK_DISABLED"],
  ["was deleted", { status: "deleted", expiresAt: null }, 410, "LINK_DELETED"],
  ["has expired", { status: "active", expiresAt: PAST }, 410, "LINK_EXPIRED"],
  ["expired and has no status field (pre-migration)", { expiresAt: PAST }, 410, "LINK_EXPIRED"],
  ["was deleted AND expired", { status: "deleted", expiresAt: PAST }, 410, "LINK_DELETED"],
  ["has a status we don't know (fail closed)", { status: "blocked", expiresAt: null }, 404, "URL_NOT_FOUND"],
];
for (const [label, row, status, code] of cases) {
  test(`a link that ${label} → ${status} ${code}`, async (t) => {
    const { update, read } = fakeDatabase(t, { live: false, row });
    await assert.rejects(resolveShortCode("abc1234"), (err) => {
      assert.equal(err.statusCode, status);
      assert.equal(err.code, code);
      assert.equal(err instanceof GoneError, status === 410);
      return true;
    });
    assert.equal(update.mock.callCount(), 1);
    assert.equal(read.mock.callCount(), 1, "exactly one extra read to classify");
  });
}

test("an unavailable link never counts a click", async (t) => {
  // The click is part of the same atomic operation as the 'is it live?' filter,
  // so when nothing matches, nothing is written. We assert the write was only
  // ever attempted WITH the live filter.
  const { update } = fakeDatabase(t, { live: false, row: { status: "active", expiresAt: PAST } });
  await assert.rejects(resolveShortCode("abc1234"));
  const [filter] = update.mock.calls[0].arguments;
  assert.ok(filter.status && filter.$or, "the write must carry the status and expiry conditions");
});

// ---------------------------------------------------------------- HEAD

test("HEAD (countClick: false) uses a read-only lookup and writes nothing", async (t) => {
  const { update, read } = fakeDatabase(t, { live: true });
  const destination = await resolveShortCode("abc1234", { countClick: false });
  assert.equal(destination, "https://example.com/dest");
  assert.equal(update.mock.callCount(), 0, "a HEAD request must not write");
  assert.equal(read.mock.callCount(), 1);
});

// ---------------------------------------------------------------- over HTTP

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

test("HTTP: the redirect answer and its headers", async (t) => {
  const { update, read } = fakeDatabase(t, { live: true });
  const { server, base } = await listen();
  t.after(() => server.close());

  await t.test("GET → 302 to the destination, never cacheable, click counted", async () => {
    const res = await fetch(`${base}/abc1234`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://example.com/dest");
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok(res.headers.get("x-request-id"));
    assert.equal(update.mock.callCount(), 1);
  });

  await t.test("HEAD → the same 302, but no click is counted", async () => {
    const before = update.mock.callCount();
    const res = await fetch(`${base}/abc1234`, { method: "HEAD", redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://example.com/dest");
    assert.equal(update.mock.callCount(), before, "HEAD must not increment clicks");
    assert.ok(read.mock.callCount() >= 1);
  });
});

test("HTTP: expired → 410 in the standard error format, also never cacheable", async (t) => {
  fakeDatabase(t, { live: false, row: { status: "active", expiresAt: PAST } });
  const { server, base } = await listen();
  t.after(() => server.close());

  const res = await fetch(`${base}/abc1234`, { redirect: "manual" });
  const body = await res.json();
  assert.equal(res.status, 410);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "LINK_EXPIRED");
  assert.ok(body.requestId);
  assert.equal(res.headers.get("cache-control"), "no-store"); // an error must not be cached either: the owner may extend the link
});

test("HTTP: deleted → 410, disabled → 404, unknown → 404", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());
  for (const [row, status, code] of [
    [{ status: "deleted", expiresAt: null }, 410, "LINK_DELETED"],
    [{ status: "disabled", expiresAt: null }, 404, "LINK_DISABLED"],
    [null, 404, "URL_NOT_FOUND"],
  ]) {
    t.mock.restoreAll();
    fakeDatabase(t, { live: false, row });
    const res = await fetch(`${base}/abc1234`, { redirect: "manual" });
    assert.equal(res.status, status);
    assert.equal((await res.json()).error.code, code);
  }
});
