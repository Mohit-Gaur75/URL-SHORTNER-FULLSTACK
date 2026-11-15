const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const ApiKey = require("../models/apiKey.model");
const apiKeyService = require("../services/apiKey.service");
const { createApiKeyBody } = require("../validators/apiKey.validator");

test("ApiKey Validator: validates key name and expiration", () => {
  // Valid key input
  const valid = createApiKeyBody.parse({ name: "Zapier Integration" });
  assert.equal(valid.name, "Zapier Integration");

  // Rejects empty name
  assert.throws(() => createApiKeyBody.parse({ name: "" }), /Name cannot be empty/);

  // Rejects name > 60 chars
  assert.throws(
    () => createApiKeyBody.parse({ name: "a".repeat(61) }),
    /cannot exceed 60 characters/
  );

  // Valid with future expiry
  const future = new Date(Date.now() + 86400000).toISOString();
  const validWithExp = createApiKeyBody.parse({ name: "Test Key", expiresAt: future });
  assert.ok(validWithExp.expiresAt instanceof Date);

  // Past expiry throws
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.throws(() => createApiKeyBody.parse({ name: "Test Key", expiresAt: past }), /Expiry must be in the future/);
});

test("ApiKey Model: validates required fields and schema constraints", async () => {
  const validDoc = new ApiKey({
    user: new mongoose.Types.ObjectId(),
    name: "CLI Token",
    keyPrefix: "sk_live_123456...7890",
    keyHash: "abc123hash",
  });
  await assert.doesNotReject(() => validDoc.validate());

  // Missing user or keyHash fails
  const missingUser = new ApiKey({ name: "No User" });
  await assert.rejects(() => missingUser.validate(), /Path `user` is required/);
});

test("ApiKey Service: generateApiKey creates formatted token and hashes", async () => {
  const origCreate = ApiKey.create;
  const fakeId = new mongoose.Types.ObjectId();
  const fakeUserId = new mongoose.Types.ObjectId();

  try {
    ApiKey.create = async (doc) => ({
      _id: fakeId,
      ...doc,
      createdAt: new Date(),
    });

    const res = await apiKeyService.generateApiKey(fakeUserId, { name: "GitHub Action" });
    assert.equal(res.name, "GitHub Action");
    assert.ok(res.rawKey.startsWith("sk_live_"));
    assert.ok(res.keyPrefix.startsWith("sk_live_"));
    assert.equal(res.id, String(fakeId));
  } finally {
    ApiKey.create = origCreate;
  }
});

test("ApiKey Service: authenticateApiKey verifies token format and checks expiration", async () => {
  // Invalid prefix rejected
  await assert.rejects(
    () => apiKeyService.authenticateApiKey("invalid_prefix_123"),
    /Invalid API key format/
  );

  const origFindOne = ApiKey.findOne;
  try {
    // Missing key in DB
    ApiKey.findOne = () => ({
      populate: async () => null,
    });
    await assert.rejects(
      () => apiKeyService.authenticateApiKey("sk_live_" + "a".repeat(48)),
      /Invalid or revoked API key/
    );

    // Expired key in DB
    ApiKey.findOne = () => ({
      populate: async () => ({
        _id: new mongoose.Types.ObjectId(),
        user: { _id: "user123", name: "Alice" },
        expiresAt: new Date(Date.now() - 10000), // in the past
      }),
    });
    await assert.rejects(
      () => apiKeyService.authenticateApiKey("sk_live_" + "a".repeat(48)),
      /API key has expired/
    );

    // Valid key in DB
    const mockUser = { _id: "user123", name: "Alice" };
    ApiKey.findOne = () => ({
      populate: async () => ({
        _id: new mongoose.Types.ObjectId(),
        user: mockUser,
        expiresAt: new Date(Date.now() + 100000),
      }),
    });
    const user = await apiKeyService.authenticateApiKey("sk_live_" + "a".repeat(48));
    assert.equal(user._id, "user123");
  } finally {
    ApiKey.findOne = origFindOne;
  }
});
