const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const app = require("../app");
const { resolveCountry, buildClickEvent, referrerHost } = require("../services/clickRecorder");
const { createUrlBody, updateUrlBody, listUrlsQuery } = require("../validators/url.validator");
const { deleteAccountBody } = require("../validators/auth.validator");

function listen(targetApp = app) {
  return new Promise((resolve) => {
    const server = http.createServer(targetApp);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

test("Micro-feature: ClickRecorder resolves geographic country accurately without storing IP", () => {
  // Cloudflare header takes precedence
  assert.equal(resolveCountry("US", "1.1.1.1"), "US");
  assert.equal(resolveCountry("IN", "127.0.0.1"), "IN");

  // Unknown header falls back to geoip-lite lookup or Unknown
  const event = buildClickEvent("507f1f77bcf86cd799439011", {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    referrer: "https://news.ycombinator.com/item?id=123",
    country: "DE",
    ip: "8.8.8.8",
  });

  assert.equal(event.country, "DE");
  assert.equal(event.device, "desktop");
  assert.equal(event.referrer, "news.ycombinator.com");
  // IP is dropped and not present on event
  assert.equal(event.ip, undefined);
});

test("Micro-feature: URL Validators accept tags, maxClicks, and expiredRedirectUrl", () => {
  // Creation schema
  const validCreate = createUrlBody.parse({
    originalUrl: "https://example.com/target",
    tags: ["ProductLaunch", "q4-sale"],
    maxClicks: 500,
    expiredRedirectUrl: "https://example.com/expired-fallback",
  });

  assert.deepEqual(validCreate.tags, ["productlaunch", "q4-sale"]); // sanitized to lowercase
  assert.equal(validCreate.maxClicks, 500);
  assert.equal(validCreate.expiredRedirectUrl, "https://example.com/expired-fallback");

  // Update schema accepts isArchived and tags
  const validUpdate = updateUrlBody.parse({
    isArchived: true,
    tags: ["archived-link"],
    maxClicks: 10,
  });
  assert.equal(validUpdate.isArchived, true);
  assert.deepEqual(validUpdate.tags, ["archived-link"]);
  assert.equal(validUpdate.maxClicks, 10);

  // List query accepts tag filter and status: "archived"
  const validQuery = listUrlsQuery.parse({
    tag: "Marketing",
    status: "archived",
  });
  assert.equal(validQuery.tag, "marketing");
  assert.equal(validQuery.status, "archived");
});

test("Micro-feature: Auth Validator requires password to confirm account deletion", () => {
  assert.throws(() => deleteAccountBody.parse({}), /Password is required/);
  assert.deepEqual(deleteAccountBody.parse({ password: "mySuperSecretPassword123" }), {
    password: "mySuperSecretPassword123",
  });
});

test("Micro-feature: Prometheus metrics endpoint (/metrics) returns valid OpenMetrics/Prometheus format", async (t) => {
  const { server, base } = await listen();
  t.after(() => server.close());

  const res = await fetch(`${base}/metrics`);
  assert.equal(res.status, 200);
  const text = await res.text();

  assert.ok(text.includes("shortener_http_request_duration_seconds"), "Includes HTTP duration histogram");
  assert.ok(text.includes("shortener_redirects_total"), "Includes redirects counter");
  assert.ok(text.includes("shortener_active_links_total"), "Includes active links gauge");
});
