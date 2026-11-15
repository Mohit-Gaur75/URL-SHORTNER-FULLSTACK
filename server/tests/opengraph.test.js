const test = require("node:test");
const assert = require("node:assert/strict");
const { createUrlBody, updateUrlBody } = require("../validators/url.validator");
const Url = require("../models/url.model");

test("OpenGraph Validator: accepts valid social metadata", () => {
  const valid = createUrlBody.parse({
    originalUrl: "https://example.com/blog/release-2026",
    metaTitle: "Launch Announcement",
    metaDescription: "Check out our brand new URL platform release.",
    metaImage: "https://example.com/og-banner.png",
  });

  assert.equal(valid.metaTitle, "Launch Announcement");
  assert.equal(valid.metaDescription, "Check out our brand new URL platform release.");
  assert.equal(valid.metaImage, "https://example.com/og-banner.png");

  // Rejects title > 120 chars
  assert.throws(
    () =>
      createUrlBody.parse({
        originalUrl: "https://example.com",
        metaTitle: "a".repeat(121),
      }),
    /cannot exceed 120 characters/
  );

  // Rejects description > 300 chars
  assert.throws(
    () =>
      createUrlBody.parse({
        originalUrl: "https://example.com",
        metaDescription: "b".repeat(301),
      }),
    /cannot exceed 300 characters/
  );

  // Update body allows updating or clearing meta
  const update = updateUrlBody.parse({
    metaTitle: null,
    metaDescription: "Updated description",
  });
  assert.equal(update.metaTitle, null);
  assert.equal(update.metaDescription, "Updated description");
});

test("OpenGraph Model: stores metaTitle, metaDescription, and metaImage", async () => {
  const link = new Url({
    originalUrl: "https://example.com/demo",
    shortCode: "meta123",
    metaTitle: "Demo Page",
    metaDescription: "Live demo of the application",
    metaImage: "https://example.com/thumb.jpg",
  });

  await assert.doesNotReject(() => link.validate());
  assert.equal(link.metaTitle, "Demo Page");
  assert.equal(link.metaDescription, "Live demo of the application");
  assert.equal(link.metaImage, "https://example.com/thumb.jpg");
});
