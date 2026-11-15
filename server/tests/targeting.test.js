const test = require("node:test");
const assert = require("node:assert/strict");
const { createUrlBody, updateUrlBody } = require("../validators/url.validator");
const urlService = require("../services/url.service");
const Url = require("../models/url.model");

test("Targeting Rules Validator: validates device and country rules", () => {
  const valid = createUrlBody.parse({
    originalUrl: "https://example.com/default",
    targetingRules: [
      { type: "device", target: "ios", destination: "https://apps.apple.com/app/123" },
      { type: "device", target: "android", destination: "https://play.google.com/store/apps/123" },
      { type: "country", target: "IN", destination: "https://in.example.com" },
    ],
  });

  assert.equal(valid.targetingRules.length, 3);
  assert.equal(valid.targetingRules[0].target, "ios");
  assert.equal(valid.targetingRules[1].destination, "https://play.google.com/store/apps/123");
  assert.equal(valid.targetingRules[2].target, "IN");

  // Rejects invalid type
  assert.throws(
    () =>
      createUrlBody.parse({
        originalUrl: "https://example.com",
        targetingRules: [{ type: "browser", target: "chrome", destination: "https://chrome.com" }],
      }),
    /Targeting rule type must be 'device' or 'country'/
  );

  // Rejects invalid destination URL
  assert.throws(
    () =>
      createUrlBody.parse({
        originalUrl: "https://example.com",
        targetingRules: [{ type: "device", target: "ios", destination: "invalid-url" }],
      }),
    /Invalid URL format/
  );

  // Update body allows updating targeting rules
  const update = updateUrlBody.parse({
    targetingRules: [{ type: "country", target: "US", destination: "https://us.example.com" }],
  });
  assert.equal(update.targetingRules.length, 1);
});

test("Targeting Rules Model: stores and returns targeting rules correctly", () => {
  const link = new Url({
    originalUrl: "https://example.com/main",
    shortCode: "target123",
    targetingRules: [
      { type: "device", target: "ios", destination: "https://apple.com" },
      { type: "country", target: "GB", destination: "https://uk.example.com" },
    ],
  });

  assert.equal(link.targetingRules.length, 2);
  assert.equal(link.targetingRules[0].type, "device");
  assert.equal(link.targetingRules[0].target, "ios");
  assert.equal(link.targetingRules[1].target, "GB");
});

test("Targeting Dynamic Routing: routes iPhone users to iOS destination and others to default", async () => {
  const mockLink = {
    _id: "660000000000000000000009",
    shortCode: "applink",
    originalUrl: "https://example.com/landing",
    status: "active",
    clicks: 10,
    maxClicks: null,
    isPasswordProtected: false,
    targetingRules: [
      { type: "device", target: "ios", destination: "https://apps.apple.com/app/myapp" },
      { type: "device", target: "android", destination: "https://play.google.com/store/apps/myapp" },
      { type: "country", target: "JP", destination: "https://jp.example.com" },
    ],
  };

  const originalFindOne = Url.findOne;
  Url.findOne = async () => mockLink;

  try {
    // 1. iPhone User Agent -> should route to iOS App Store
    const iosUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    const destIos = await urlService.resolveShortCode("applink", {
      countClick: false,
      context: { userAgent: iosUa, country: "US" },
    });
    assert.equal(destIos, "https://apps.apple.com/app/myapp");

    // 2. Android User Agent -> should route to Google Play Store
    const androidUa = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
    const destAndroid = await urlService.resolveShortCode("applink", {
      countClick: false,
      context: { userAgent: androidUa, country: "US" },
    });
    assert.equal(destAndroid, "https://play.google.com/store/apps/myapp");

    // 3. Desktop user from Japan -> should route to Japan landing page
    const desktopUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const destJapan = await urlService.resolveShortCode("applink", {
      countClick: false,
      context: { userAgent: desktopUa, country: "JP" },
    });
    assert.equal(destJapan, "https://jp.example.com");

    // 4. Desktop user from Germany -> no rule matches, should fall back to default originalUrl
    const destDefault = await urlService.resolveShortCode("applink", {
      countClick: false,
      context: { userAgent: desktopUa, country: "DE" },
    });
    assert.equal(destDefault, "https://example.com/landing");
  } finally {
    Url.findOne = originalFindOne;
  }
});
