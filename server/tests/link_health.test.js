const test = require("node:test");
const assert = require("node:assert/strict");
const { probeUrl, checkLinkHealthFor } = require("../services/linkHealth.service");
const Url = require("../models/url.model");
const { NotFoundError } = require("../utils/errors");

test("probeUrl: returns healthy when target responds 200 OK", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    statusText: "OK",
  });

  try {
    const result = await probeUrl("https://example.com");
    assert.equal(result.status, "healthy");
    assert.equal(result.statusCode, 200);
    assert.equal(result.error, null);
    assert.ok(typeof result.latencyMs === "number");
    assert.ok(result.checkedAt instanceof Date);
  } finally {
    global.fetch = originalFetch;
  }
});

test("probeUrl: handles 405 Method Not Allowed by falling back to GET", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push(options.method);
    if (options.method === "HEAD") {
      return { status: 405, statusText: "Method Not Allowed" };
    }
    return { status: 200, statusText: "OK" };
  };

  try {
    const result = await probeUrl("https://example.com/api");
    assert.equal(result.status, "healthy");
    assert.equal(result.statusCode, 200);
    assert.deepEqual(calls, ["HEAD", "GET"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("probeUrl: returns broken for 404 or 500 error responses", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 404,
    statusText: "Not Found",
  });

  try {
    const result = await probeUrl("https://example.com/nonexistent");
    assert.equal(result.status, "broken");
    assert.equal(result.statusCode, 404);
    assert.match(result.error, /HTTP 404 Not Found/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("probeUrl: handles network error / unreachable hosts gracefully", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("getaddrinfo ENOTFOUND invalid-domain.test");
  };

  try {
    const result = await probeUrl("https://invalid-domain.test");
    assert.equal(result.status, "broken");
    assert.equal(result.statusCode, null);
    assert.match(result.error, /ENOTFOUND/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("checkLinkHealthFor: updates url model health telemetry", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    statusText: "OK",
  });

  const mockUrl = {
    _id: "660000000000000000000001",
    user: "507f1f77bcf86cd799439011",
    originalUrl: "https://my-company.com",
    healthStatus: "unknown",
    save: async function () {
      return this;
    },
  };

  const originalFindOne = Url.findOne;
  Url.findOne = async () => mockUrl;

  try {
    const updated = await checkLinkHealthFor({ _id: "507f1f77bcf86cd799439011", role: "USER" }, mockUrl._id);
    assert.equal(updated.healthStatus, "healthy");
    assert.equal(updated.healthStatusCode, 200);
    assert.ok(updated.lastHealthCheckedAt instanceof Date);
  } finally {
    global.fetch = originalFetch;
    Url.findOne = originalFindOne;
  }
});

test("checkLinkHealthFor: throws NotFoundError when link not found or access denied", async () => {
  const originalFindOne = Url.findOne;
  Url.findOne = async () => null;

  try {
    await assert.rejects(
      () => checkLinkHealthFor({ _id: "507f1f77bcf86cd799439011", role: "USER" }, "660000000000000000000001"),
      NotFoundError
    );
  } finally {
    Url.findOne = originalFindOne;
  }
});
