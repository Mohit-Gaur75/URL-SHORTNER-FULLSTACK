const test = require("node:test");
const assert = require("node:assert/strict");
const { createUrlBody, updateUrlBody, verifyPasswordBody } = require("../validators/url.validator");
const { hashPassword, verifyPassword } = require("../utils/password");
const urlService = require("../services/url.service");
const Url = require("../models/url.model");

test("Password Protection Validator: accepts valid passwords and validates format", () => {
  // Valid passwords
  const valid = createUrlBody.parse({
    originalUrl: "https://example.com/vault",
    password: "securePass123!",
  });
  assert.equal(valid.password, "securePass123!");

  // Reject too short password (< 3 chars)
  assert.throws(
    () =>
      createUrlBody.parse({
        originalUrl: "https://example.com/vault",
        password: "ab",
      }),
    /at least 3 characters/
  );

  // Update accepts clearing password with null or empty string
  const cleared = updateUrlBody.parse({
    password: null,
  });
  assert.equal(cleared.password, null);

  // verifyPasswordBody
  assert.throws(() => verifyPasswordBody.parse({}), /Password is required/);
  assert.equal(verifyPasswordBody.parse({ password: "pass" }).password, "pass");
});

test("Password Protection Service: hashes password and verifies correctly", async () => {
  const plain = "SuperSecretPIN2026";
  const hash = await hashPassword(plain);

  assert.notEqual(hash, plain);
  assert.equal(await verifyPassword(plain, hash), true);
  assert.equal(await verifyPassword("wrongPIN", hash), false);
});
