const crypto = require("node:crypto");
const Webhook = require("../models/webhook.model");
const { NotFoundError } = require("../utils/errors");

/**
 * Generates a cryptographically random webhook signing secret.
 */
function generateWebhookSecret() {
  return `hook_sec_${crypto.randomBytes(24).toString("hex")}`;
}

/**
 * Signs payload using HMAC-SHA256.
 */
function signPayload(secret, payloadString) {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

/**
 * Creates a new webhook for a user.
 */
async function createWebhook({ userId, url, description, events }) {
  const secret = generateWebhookSecret();
  const webhook = await Webhook.create({
    user: userId,
    url,
    description: description || "",
    events: events && events.length > 0 ? events : undefined,
    secret,
  });

  return webhook;
}

/**
 * Lists all webhooks belonging to a user.
 */
async function listWebhooks(userId) {
  const webhooks = await Webhook.find({ user: userId }).sort({ createdAt: -1 }).lean();
  return webhooks.map((wh) => ({
    ...wh,
    id: wh._id.toString(),
    secret: wh.secret ? `hook_sec_••••${wh.secret.slice(-4)}` : null,
  }));
}

/**
 * Retrieves a webhook by ID for an authorized user.
 */
async function getWebhookById(userId, webhookId) {
  const webhook = await Webhook.findOne({ _id: webhookId, user: userId });
  if (!webhook) {
    throw new NotFoundError("Webhook not found", "WEBHOOK_NOT_FOUND");
  }
  return webhook;
}

/**
 * Updates a webhook's configuration.
 */
async function updateWebhook(userId, webhookId, updates) {
  const webhook = await getWebhookById(userId, webhookId);

  if (updates.url !== undefined) webhook.url = updates.url;
  if (updates.description !== undefined) webhook.description = updates.description;
  if (updates.events !== undefined) webhook.events = updates.events;
  if (updates.status !== undefined) {
    webhook.status = updates.status;
    if (updates.status === "active") {
      webhook.failureCount = 0;
      webhook.lastError = null;
    }
  }

  await webhook.save();
  return webhook;
}

/**
 * Deletes a webhook.
 */
async function deleteWebhook(userId, webhookId) {
  const result = await Webhook.deleteOne({ _id: webhookId, user: userId });
  if (result.deletedCount === 0) {
    throw new NotFoundError("Webhook not found", "WEBHOOK_NOT_FOUND");
  }
}

/**
 * Delivers an HTTP payload to a specific webhook endpoint with HMAC signature.
 */
async function deliverWebhook(webhook, event, payload) {
  const deliveryId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify({
    id: deliveryId,
    event,
    timestamp,
    data: payload,
  });

  const signature = signPayload(webhook.secret, payloadString);
  const start = performance.now();

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "ShortLink-Webhooks/1.0",
        "x-shortener-delivery": deliveryId,
        "x-shortener-event": event,
        "x-shortener-timestamp": String(timestamp),
        "x-shortener-signature": `sha256=${signature}`,
      },
      body: payloadString,
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Math.round(performance.now() - start);
    const isSuccess = res.status >= 200 && res.status < 300;

    webhook.lastDeliveredAt = new Date();
    webhook.lastStatusCode = res.status;

    if (isSuccess) {
      webhook.failureCount = 0;
      webhook.lastError = null;
    } else {
      webhook.failureCount = (webhook.failureCount || 0) + 1;
      webhook.lastError = `Received HTTP ${res.status} ${res.statusText || ""}`.trim();
    }

    try {
      await webhook.save();
    } catch {
      // Non-fatal if DB write times out in unmocked tests
    }

    return {
      success: isSuccess,
      statusCode: res.status,
      latencyMs,
      error: webhook.lastError,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    webhook.lastDeliveredAt = new Date();
    webhook.lastStatusCode = null;
    webhook.failureCount = (webhook.failureCount || 0) + 1;
    webhook.lastError = (err.name === "TimeoutError" ? "Connection timed out (5s)" : err.message || "Failed to deliver payload").slice(0, 500);

    try {
      await webhook.save();
    } catch {
      // Non-fatal
    }

    return {
      success: false,
      statusCode: null,
      latencyMs,
      error: webhook.lastError,
    };
  }
}

/**
 * Dispatches an event to all active webhooks registered for the user and event.
 * Runs non-blocking / asynchronously.
 */
function dispatchWebhookEvent(userId, event, payload) {
  if (!userId) return;

  // Run in background without awaiting or blocking the caller
  setImmediate(async () => {
    try {
      const webhooks = await Webhook.find({
        user: userId,
        status: "active",
        events: event,
      });

      if (!webhooks || webhooks.length === 0) return;

      await Promise.allSettled(
        webhooks.map((wh) => deliverWebhook(wh, event, payload))
      );
    } catch (err) {
      // Webhook dispatch failures must never crash server or disrupt users
      console.error("[Webhooks] Dispatch error:", err.message);
    }
  });
}

/**
 * Sends a test ping to verify a webhook URL.
 */
async function testWebhook(userId, webhookId) {
  const webhook = await getWebhookById(userId, webhookId);
  const result = await deliverWebhook(webhook, "ping", {
    message: "ShortLink Webhook Test Dispatch",
    endpoint: webhook.url,
    registeredEvents: webhook.events,
  });

  return {
    delivery: result,
    webhook: {
      id: webhook._id.toString(),
      url: webhook.url,
      lastStatusCode: webhook.lastStatusCode,
      lastDeliveredAt: webhook.lastDeliveredAt,
      failureCount: webhook.failureCount,
    },
  };
}

module.exports = {
  generateWebhookSecret,
  signPayload,
  createWebhook,
  listWebhooks,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  deliverWebhook,
  dispatchWebhookEvent,
  testWebhook,
};
