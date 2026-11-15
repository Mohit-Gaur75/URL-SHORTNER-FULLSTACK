const env = require("../config/env");
const ClickEvent = require("../models/clickEvent.model");
const { parseUserAgent } = require("../utils/userAgent");
let geoip;
try {
  geoip = require("geoip-lite");
} catch {
  geoip = null;
}

// "https://news.example.com/story/42?utm=x#top"  →  "news.example.com"
// The path and query string can contain tokens, search terms or ids, so only the
// site's name is kept.
function referrerHost(raw) {
  if (typeof raw !== "string" || !raw) return "direct";
  try {
    const url = new URL(raw.slice(0, 2048));
    if (!["http:", "https:", "android-app:"].includes(url.protocol)) return "other";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host ? host.slice(0, 100) : "direct";
  } catch {
    return "direct";
  }
}

function resolveCountry(countryHeader, ip) {
  if (
    countryHeader &&
    typeof countryHeader === "string" &&
    countryHeader !== "XX" &&
    countryHeader !== "Unknown"
  ) {
    return countryHeader.slice(0, 10).toUpperCase();
  }
  if (geoip && ip && typeof ip === "string") {
    try {
      const cleanIp = ip.replace(/^.*:/, "");
      const geo = geoip.lookup(cleanIp);
      if (geo && geo.country) {
        return geo.country.toUpperCase();
      }
    } catch {
      // ignore lookup issues on local/malformed IP
    }
  }
  return "Unknown";
}

// Everything stored about a visit is decided here, in one place.
// Privacy note: The raw IP and User-Agent are dropped immediately after categorization.
function buildClickEvent(linkId, { userAgent, referrer, country, ip }, now = new Date()) {
  const ua = parseUserAgent(userAgent);
  const resolvedCountry = resolveCountry(country, ip);
  return {
    url: linkId,
    clickedAt: now,
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    referrer: referrerHost(referrer),
    country: resolvedCountry,
  };
}

// FIRE AND FORGET. The visitor is waiting for their redirect; analytics must never slow
// it down or break it. We start the write and do NOT wait for it. If it fails, we log and
// move on. The price: if the server crashes at that instant, that one event is lost,
// which is acceptable for statistics (Phase 15 makes this sturdier with a queue).
//
// Not recorded: visitors sending "Do Not Track" or "Global Privacy Control" (the click
// counter still counts them, because a number identifies nobody).
function recordClick(linkId, context) {
  if (!linkId || !context || context.doNotTrack) return;
  try {
    ClickEvent.create(buildClickEvent(linkId, context)).catch((err) => {
      if (env.nodeEnv !== "test") console.warn("[analytics] click not recorded:", err.message);
    });
  } catch (err) {
    if (env.nodeEnv !== "test") console.warn("[analytics] click not recorded:", err.message);
  }
}

module.exports = { recordClick, buildClickEvent, referrerHost, resolveCountry };
