const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  generateWebhookSecret,
  signPayload,
  createWebhook,
  listWebhooks,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  deliverWebhook,
  testWebhook,
} = require("../services/webhook.service");
const { createWebhookBody, updateWebhookBody } = require("../validators/webhook.validator");
const Webhook = require("../models/webhook.model");
const { NotFoundError } = require("../utils/errors");

test("Webhook Secret & Signature: generates secure secret and signs HMAC-SHA256", () => {
  const secret = generateWebhookSecret();
  assert.ok(secret.startsWith("whsec_"));
  assert.equal(secret.length, 6 + 48); // "whsec_" + 48 hex chars (24 bytes)

  const payload = JSON.stringify({ event: "link.clicked", timestamp: 1700000000 });
  const signature = signPayload(secret, payload);
  assert.equal(typeof signature, "string");
  assert.equal(signature.length, 64); // 32 bytes hex = 64 chars

  // Verifying HMAC calculation directly
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(signature, expectedSig);

  // Different payload produces different signature
  const diffSig = signPayload(secret, JSON.stringify({ event: "link.expired" }));
  assert.notEqual(signature, diffSig);
});

test("Webhook Validator: validates creation and update schemas", () => {
  // Valid create
  const valid = createWebhookBody.parse({
    url: "https://example.com/api/events",
    description: "Production Event Bus",
    events: ["link.clicked", "link.quota_reached"],
  });
  assert.equal(valid.url, "https://example.com/api/events");
  assert.equal(valid.description, "Production Event Bus");
  assert.deepEqual(valid.events, ["link.clicked", "link.quota_reached"]);

  // Rejects invalid URLs
  assert.throws(() => createWebhookBody.parse({ url: "ftp://example.com" }), /Only http and https/);
  assert.throws(() => createWebhookBody.parse({ url: "not-a-url" }), /Invalid URL format/);

  // Rejects invalid events
  assert.throws(
    () => createWebhookBody.parse({ url: "https://example.com", events: ["invalid.event"] }),
    /Invalid/
  );

  // Update validator
  const update = updateWebhookBody.parse({
    status: "disabled",
    description: "Temporarily disabled",
  });
  assert.equal(update.status, "disabled");
  assert.equal(update.description, "Temporarily disabled");

  // Rejects empty update
  assert.throws(() => updateWebhookBody.parse({}), /No fields provided to update/);
});

test("Webhook Delivery: sends signed POST payload with expected headers", async () => {
  const originalFetch = global.fetch;
  let sentHeaders = null;
  let sentBody = null;

  global.fetch = async (url, options) => {
    sentHeaders = options.headers;
    sentBody = JSON.parse(options.body);
    return {
      status: 200,
      statusText: "OK",
    };
  };

  const fakeWebhook = {
    url: "https://consumer.app/webhook",
    secret: "whsec_testsecret1234567890123456789012",
    save: async () => {},
  };

  try {
    const res = await deliverWebhook(fakeWebhook, "link.clicked", {
      shortCode: "testCode",
      originalUrl: "https://google.com",
    });

    assert.equal(res.success, true);
    assert.equal(res.statusCode, 200);
    assert.equal(fakeWebhook.lastStatusCode, 200);
    assert.equal(fakeWebhook.failureCount, 0);

    // Verify headers
    assert.equal(sentHeaders["x-shortener-event"], "link.clicked");
    assert.ok(sentHeaders["x-shortener-delivery"]);
    assert.ok(sentHeaders["x-shortener-timestamp"]);
    assert.ok(sentHeaders["x-shortener-signature"].startsWith("sha256="));

    // Verify payload signature authenticity
    const sig = sentHeaders["x-shortener-signature"].replace("sha256=", "");
    const rawExpected = crypto
      .createHmac("sha256", fakeWebhook.secret)
      .update(JSON.stringify(sentBody))
      .digest("hex");
    assert.equal(sig, rawExpected);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Webhook Delivery: handles consumer error status and network failure", async () => {
  const originalFetch = global.fetch;

  // 1. Consumer returns 500
  global.fetch = async () => ({
    status: 500,
    statusText: "Internal Server Error",
  });

  const fakeWebhook = {
    url: "https://consumer.app/webhook",
    secret: "whsec_test123",
    failureCount: 0,
    save: async () => {},
  };

  try {
    const res = await deliverWebhook(fakeWebhook, "link.clicked", {});
    assert.equal(res.success, false);
    assert.equal(res.statusCode, 500);
    assert.equal(fakeWebhook.failureCount, 1);
    assert.match(fakeWebhook.lastError, /HTTP 500/);

    // 2. Consumer times out
    global.fetch = async () => {
      const err = new Error("Connection timed out");
      err.name = "TimeoutError";
      throw err;
    };

    const res2 = await deliverWebhook(fakeWebhook, "link.quota_reached", {});
    assert.equal(res2.success, false);
    assert.equal(fakeWebhook.failureCount, 2);
    assert.match(fakeWebhook.lastError, /timed out/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Webhook Service: CRUD and testWebhook execution", async () => {
  const fakeUserId = "507f1f77bcf86cd799439011";
  const fakeWebhookId = "660000000000000000000002";

  const originalCreate = Webhook.create;
  const originalFind = Webhook.find;
  const originalFindOne = Webhook.findOne;
  const originalDeleteOne = Webhook.deleteOne;
  const originalFetch = global.fetch;

  global.fetch = async () => ({ status: 200, statusText: "OK" });

  const mockWebhookDoc = {
    _id: fakeWebhookId,
    user: fakeUserId,
    url: "https://example.com/webhook",
    secret: "whsec_0123456789abcdef0123456789abcdef0123456789abcdef",
    description: "Test Webhook",
    events: ["link.clicked"],
    status: "active",
    failureCount: 0,
    save: async function () {
      return this;
    },
  };

  Webhook.create = async (doc) => ({ ...mockWebhookDoc, ...doc, _id: fakeWebhookId });
  Webhook.find = () => ({
    sort: () => ({
      lean: async () => [mockWebhookDoc],
    }),
  });
  Webhook.findOne = async () => mockWebhookDoc;
  Webhook.deleteOne = async () => ({ deletedCount: 1 });

  try {
    // 1. Create
    const created = await createWebhook({
      userId: fakeUserId,
      url: "https://example.com/webhook",
      description: "Test Webhook",
      events: ["link.clicked"],
    });
    assert.equal(created.url, "https://example.com/webhook");
    assert.ok(created.secret.startsWith("whsec_"));

    // 2. List
    const list = await listWebhooks(fakeUserId);
    assert.equal(list.length, 1);
    assert.ok(list[0].secret.startsWith("whsec_••••")); // masked

    // 3. Update
    const updated = await updateWebhook(fakeUserId, fakeWebhookId, {
      description: "Updated Description",
      status: "disabled",
    });
    assert.equal(updated.description, "Updated Description");
    assert.equal(updated.status, "disabled");

    // 4. Test Webhook Ping
    const testResult = await testWebhook(fakeUserId, fakeWebhookId);
    assert.equal(testResult.delivery.success, true);
    assert.equal(testResult.delivery.statusCode, 200);

    // 5. Delete
    await deleteWebhook(fakeUserId, fakeWebhookId);
  } finally {
    Webhook.create = originalCreate;
    Webhook.find = originalFind;
    Webhook.findOne = originalFindOne;
    Webhook.deleteOne = originalDeleteOne;
    global.fetch = originalFetch;
  }
});
