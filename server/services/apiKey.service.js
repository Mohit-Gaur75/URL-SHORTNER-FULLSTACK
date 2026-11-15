const crypto = require("node:crypto");
const ApiKey = require("../models/apiKey.model");
const User = require("../models/user.model");
const { AuthenticationError, NotFoundError } = require("../utils/errors");

function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

async function generateApiKey(userId, { name, expiresAt = null }) {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const rawKey = `sk_live_${randomBytes}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;

  const record = await ApiKey.create({
    user: userId,
    name: name.trim(),
    keyPrefix,
    keyHash,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  return {
    id: String(record._id),
    name: record.name,
    keyPrefix: record.keyPrefix,
    rawKey, // Returned ONLY on initial creation
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

async function listApiKeys(userId) {
  const keys = await ApiKey.find({ user: userId, status: "active" })
    .sort({ createdAt: -1 })
    .lean();

  return keys.map((k) => ({
    id: String(k._id),
    name: k.name,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    createdAt: k.createdAt,
  }));
}

async function revokeApiKey(userId, keyId) {
  const result = await ApiKey.findOneAndUpdate(
    { _id: keyId, user: userId, status: "active" },
    { $set: { status: "revoked" } },
    { new: true }
  );

  if (!result) {
    throw new NotFoundError("API key not found or already revoked");
  }

  return { success: true };
}

async function authenticateApiKey(rawKey) {
  if (typeof rawKey !== "string" || !rawKey.startsWith("sk_live_")) {
    throw new AuthenticationError("Invalid API key format");
  }

  const keyHash = hashKey(rawKey);
  const keyDoc = await ApiKey.findOne({ keyHash, status: "active" }).populate("user");

  if (!keyDoc || !keyDoc.user) {
    throw new AuthenticationError("Invalid or revoked API key");
  }

  if (keyDoc.expiresAt && new Date() > keyDoc.expiresAt) {
    throw new AuthenticationError("API key has expired");
  }

  // Update lastUsedAt in background without delaying request
  ApiKey.updateOne({ _id: keyDoc._id }, { $set: { lastUsedAt: new Date() } }).catch((err) => {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[apiKey] Failed to update lastUsedAt:", err.message);
    }
  });

  return keyDoc.user;
}

module.exports = {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  authenticateApiKey,
};
