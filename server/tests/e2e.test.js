// Run with: npm test
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = (() => {
  try {
    return require("bcrypt");
  } catch {
    return require("bcryptjs");
  }
})();

const app = require("../app");
const User = require("../models/user.model");
const Url = require("../models/url.model");
const RefreshToken = require("../models/refreshToken.model");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    );
  });
}

test("End-to-End User and Link Lifecycle Integration Flow", async (t) => {
  // In-Memory Database Store for testing the entire integrated lifecycle
  const users = new Map();
  const urls = new Map();
  const refreshTokens = new Map();

  // Mock User collection methods
  t.mock.method(User, "create", async (data) => {
    const email = data.email.toLowerCase().trim();
    for (const u of users.values()) {
      if (u.email === email) {
        const err = new Error("Duplicate key");
        err.code = 11000;
        err.keyPattern = { email: 1 };
        throw err;
      }
    }
    const id = new mongoose.Types.ObjectId().toString();
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const doc = {
      _id: id,
      id,
      name: data.name,
      email,
      password: hashedPassword,
      role: "USER",
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(id, doc);
    return doc;
  });

  t.mock.method(User, "findOne", (filter) => {
    const email = filter.email?.toLowerCase?.()?.trim?.() ?? filter.email;
    const found = Array.from(users.values()).find((u) => u.email === email);
    return {
      select: () => (found ? { ...found } : null),
    };
  });

  t.mock.method(User, "findById", async (id) => {
    const found = users.get(String(id));
    return found ? { ...found } : null;
  });

  // Mock RefreshToken collection methods
  t.mock.method(RefreshToken, "create", async (data) => {
    const id = new mongoose.Types.ObjectId().toString();
    const doc = { _id: id, id, revokedAt: null, ...data };
    refreshTokens.set(data.tokenHash, doc);
    return doc;
  });

  t.mock.method(RefreshToken, "findOneAndUpdate", async (filter, update) => {
    const row = refreshTokens.get(filter.tokenHash);
    if (!row) return null;
    if (row.revokedAt !== null) return null;
    if (row.expiresAt <= (filter.expiresAt?.$gt || new Date())) return null;

    const previous = { ...row };
    if (update.$set?.revokedAt) {
      row.revokedAt = update.$set.revokedAt;
    }
    return previous;
  });

  t.mock.method(RefreshToken, "findOne", async (filter) => {
    return refreshTokens.get(filter.tokenHash) || null;
  });

  t.mock.method(RefreshToken, "updateMany", async (filter, update) => {
    let count = 0;
    for (const row of refreshTokens.values()) {
      if (filter.family && String(row.family) === String(filter.family)) {
        if (update.$set?.revokedAt) row.revokedAt = update.$set.revokedAt;
        count++;
      }
    }
    return { modifiedCount: count };
  });

  // Mock Url collection methods
  t.mock.method(Url, "create", async (data) => {
    for (const u of urls.values()) {
      if (u.shortCode === data.shortCode) {
        const err = new Error("Duplicate key");
        err.code = 11000;
        err.keyPattern = { shortCode: 1 };
        throw err;
      }
    }
    const id = new mongoose.Types.ObjectId().toString();
    const doc = {
      _id: id,
      id,
      user: data.user,
      originalUrl: data.originalUrl,
      shortCode: data.shortCode,
      isCustomAlias: Boolean(data.isCustomAlias),
      status: "active",
      clicks: 0,
      lastClickedAt: null,
      expiresAt: data.expiresAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    urls.set(id, doc);
    return doc;
  });

  t.mock.method(Url, "findOne", (filter) => {
    let match = null;
    if (filter._id) match = urls.get(String(filter._id));
    if (!match && filter.shortCode) {
      match = Array.from(urls.values()).find((u) => u.shortCode === filter.shortCode);
    }
    if (match && filter.status?.$in && !filter.status.$in.includes(match.status)) {
      match = null;
    }
    if (match && filter.status && typeof filter.status === "string" && match.status !== filter.status) {
      match = null;
    }
    return {
      lean: () => (match ? { ...match } : null),
      exec: async () => (match ? { ...match } : null),
      then: (resolve) => resolve(match ? { ...match } : null),
    };
  });

  t.mock.method(Url, "find", (filter) => {
    const list = Array.from(urls.values()).filter((u) => {
      if (filter.user && String(u.user) !== String(filter.user)) return false;
      if (filter.status?.$in && !filter.status.$in.includes(u.status)) return false;
      return true;
    });

    return {
      sort: () => ({
        skip: (skipCount) => ({
          limit: (limitCount) => {
            const pageItems = list.slice(skipCount, skipCount + limitCount);
            return {
              lean: () => Promise.resolve(pageItems),
              then: (resolve) => resolve(pageItems),
            };
          },
        }),
      }),
    };
  });

  t.mock.method(Url, "countDocuments", async (filter) => {
    return Array.from(urls.values()).filter((u) => {
      if (filter.user && String(u.user) !== String(filter.user)) return false;
      return true;
    }).length;
  });

  t.mock.method(Url, "findOneAndUpdate", async (filter, update) => {
    let match = null;
    if (filter._id) match = urls.get(String(filter._id));
    if (!match && filter.shortCode) {
      match = Array.from(urls.values()).find((u) => u.shortCode === filter.shortCode);
    }
    if (!match) return null;

    if (filter.status?.$in && !filter.status.$in.includes(match.status)) {
      return null;
    }
    if (filter.status && typeof filter.status === "string" && match.status !== filter.status) {
      return null;
    }

    if (update.$inc?.clicks) {
      match.clicks = (match.clicks || 0) + update.$inc.clicks;
    }
    if (update.$set) {
      Object.assign(match, update.$set);
    }
    return { ...match };
  });

  t.mock.method(Url, "updateOne", async (filter, update) => {
    let match = null;
    if (filter.shortCode) {
      match = Array.from(urls.values()).find((u) => u.shortCode === filter.shortCode);
    }
    if (match) {
      if (update.$inc?.clicks) match.clicks = (match.clicks || 0) + update.$inc.clicks;
      if (update.$set) Object.assign(match, update.$set);
    }
    return { modifiedCount: match ? 1 : 0 };
  });

  // Start real HTTP Server on random port
  const { server, base } = await listen();
  t.after(() => server.close());

  let accessToken = null;
  let refreshCookie = null;
  let createdUrlId = null;

  // 1. User Registration Flow
  await t.test("1. POST /api/auth/register: registers a new account with tokens and cookie", async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice Engineer",
        email: "alice@example.com",
        password: "SuperSecretPassword123!",
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.user.name, "Alice Engineer");
    assert.equal(data.user.email, "alice@example.com");
    assert.ok(data.accessToken, "Expected accessToken in response");

    accessToken = data.accessToken;
    const cookieHeader = res.headers.get("set-cookie");
    assert.ok(cookieHeader, "Expected set-cookie header with refresh token");
    refreshCookie = cookieHeader.split(";")[0]; // "refreshToken=..."
  });

  // 2. Profile Verification Flow
  await t.test("2. GET /api/auth/me: retrieves authenticated profile using Bearer token", async () => {
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.email, "alice@example.com");
  });

  // 3. Link Creation Flow (Custom Alias)
  await t.test("3. POST /api/urls: creates short URL with custom alias", async () => {
    const res = await fetch(`${base}/api/urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        originalUrl: "https://example.com/production-guide",
        customCode: "prod-guide",
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.shortCode, "prod-guide");
    assert.equal(data.isCustomAlias, true);
    assert.equal(data.status, "active");
    assert.equal(data.originalUrl, "https://example.com/production-guide");

    createdUrlId = data.id;
  });

  // 4. Redirect Engine Flow (Public 302 Resolution)
  await t.test("4. GET /:code: resolves short code to 302 redirect with no-cache headers", async () => {
    const res = await fetch(`${base}/prod-guide`, {
      redirect: "manual", // Do not auto-follow so we can inspect the 302 response
    });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://example.com/production-guide");
    assert.match(res.headers.get("cache-control"), /no-store/);
  });

  // 5. Dashboard Link Listing
  await t.test("5. GET /api/urls: lists links with pagination metadata", async () => {
    const res = await fetch(`${base}/api/urls`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items));
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].shortCode, "prod-guide");
    assert.equal(data.pagination.total, 1);
  });

  // 6. Link Update Flow
  await t.test("6. PATCH /api/urls/:id: updates destination URL", async () => {
    const res = await fetch(`${base}/api/urls/${createdUrlId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        originalUrl: "https://example.com/updated-guide",
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.originalUrl, "https://example.com/updated-guide");
  });

  // 7. Token Refresh Rotation Flow
  await t.test("7. POST /api/auth/refresh: rotates session with new token pair", async () => {
    const res = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: refreshCookie,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.accessToken);
    accessToken = data.accessToken;

    const newCookieHeader = res.headers.get("set-cookie");
    assert.ok(newCookieHeader);
    refreshCookie = newCookieHeader.split(";")[0];
  });

  // 8. Soft Deletion and 410 Gone Verification
  await t.test("8. DELETE /api/urls/:id: deletes link and renders code 410 Gone", async () => {
    const delRes = await fetch(`${base}/api/urls/${createdUrlId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(delRes.status, 204);

    // Verify subsequent lookup yields 410 Gone
    const redirectRes = await fetch(`${base}/prod-guide`, { redirect: "manual" });
    assert.equal(redirectRes.status, 410);
    const errorBody = await redirectRes.json();
    assert.equal(errorBody.error.code, "LINK_DELETED");
  });

  // 9. Logout & Revocation Flow
  await t.test("9. POST /api/auth/logout: terminates session and revokes refresh token", async () => {
    const logoutRes = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: refreshCookie,
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    assert.equal(logoutRes.status, 204);

    // Verify revoked token cannot be refreshed again
    const staleRefreshRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: refreshCookie,
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    assert.equal(staleRefreshRes.status, 401);
  });
});
