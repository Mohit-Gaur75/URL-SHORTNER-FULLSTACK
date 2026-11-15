const Url = require("../models/url.model");
const { NotFoundError } = require("../utils/errors");

/**
 * Performs an HTTP probe to inspect destination availability and latency.
 * Uses HEAD first with a 4-second timeout, falling back to GET on 405 Method Not Allowed.
 */
async function probeUrl(targetUrl) {
  const start = performance.now();
  let statusCode = null;
  let latencyMs = null;

  try {
    let response;
    try {
      response = await fetch(targetUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(4000),
        redirect: "follow",
        headers: { "user-agent": "ShortLink-HealthCheck/1.0" },
      });
      // Some servers block HEAD with 405 Method Not Allowed; retry with GET
      if (response.status === 405 || response.status === 501) {
        response = await fetch(targetUrl, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
          redirect: "follow",
          headers: { "user-agent": "ShortLink-HealthCheck/1.0" },
        });
      }
    } catch (headErr) {
      // If HEAD failed with network error, attempt one GET fallback
      response = await fetch(targetUrl, {
        method: "GET",
        signal: AbortSignal.timeout(4000),
        redirect: "follow",
        headers: { "user-agent": "ShortLink-HealthCheck/1.0" },
      });
    }

    latencyMs = Math.round(performance.now() - start);
    statusCode = response.status;

    if (response.status >= 200 && response.status < 400) {
      return {
        status: latencyMs > 2500 ? "warning" : "healthy",
        statusCode,
        latencyMs,
        error: latencyMs > 2500 ? "High response latency (>2.5s)" : null,
        checkedAt: new Date(),
      };
    }

    return {
      status: "broken",
      statusCode,
      latencyMs,
      error: `HTTP ${statusCode} ${response.statusText || "Error"}`,
      checkedAt: new Date(),
    };
  } catch (err) {
    latencyMs = Math.round(performance.now() - start);
    const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
    const errorMsg = isTimeout
      ? "Connection timed out after 4 seconds"
      : (err.message || "Failed to establish connection to destination");

    return {
      status: "broken",
      statusCode: null,
      latencyMs,
      error: errorMsg.slice(0, 300),
      checkedAt: new Date(),
    };
  }
}

async function checkLinkHealthFor(actor, linkId) {
  const filter = { _id: linkId };
  if (actor.role !== "ADMIN") {
    filter.user = actor._id;
  }

  const link = await Url.findOne(filter);
  if (!link) {
    throw new NotFoundError("Link not found or access denied", "LINK_NOT_FOUND");
  }

  const probe = await probeUrl(link.originalUrl);

  link.healthStatus = probe.status;
  link.healthStatusCode = probe.statusCode;
  link.healthLatencyMs = probe.latencyMs;
  link.lastHealthCheckedAt = probe.checkedAt;
  link.healthError = probe.error;
  await link.save();

  return link;
}

module.exports = {
  probeUrl,
  checkLinkHealthFor,
};
