// Turns a browser's User-Agent header into three coarse labels. We keep the labels
// and throw the raw string away: a full User-Agent is a fingerprinting vector
// (a rare combination of versions can identify one person's browser).
//
// User-Agent strings are messy and every browser pretends to be several others,
// so ORDER MATTERS below: Edge and Opera also say "Chrome", Chrome also says
// "Safari". The most specific name must be checked first.
//
// This is a deliberately small hand-written reader instead of a library: it covers the
// browsers that make up nearly all traffic, and avoids a dependency that parses
// untrusted input. Known blind spots: Brave identifies itself as Chrome, and iPads
// in "desktop mode" identify themselves as Macs.

const MAX_LENGTH = 512; // never parse more than this; the header is attacker-controlled

const BOT =
  /bot|crawler|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|telegram|discord|slack|curl\/|wget\/|python-requests|go-http-client|headless|lighthouse|pingdom|uptimerobot/i;

function operatingSystem(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (ua.includes("Android")) return "Android"; // before Linux: Android UAs also say Linux
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("CrOS")) return "ChromeOS";
  if (ua.includes("Mac OS X") || ua.includes("Macintosh")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
}

function browser(ua) {
  if (ua.includes("Edg/") || ua.includes("EdgA/") || ua.includes("EdgiOS/") || ua.includes("Edge/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("SamsungBrowser")) return "Samsung Internet";
  if (ua.includes("Firefox/") || ua.includes("FxiOS/")) return "Firefox";
  if (ua.includes("Chrome/") || ua.includes("CriOS/")) return "Chrome";
  if (ua.includes("Safari/") && ua.includes("Version/")) return "Safari";
  if (ua.includes("MSIE ") || ua.includes("Trident/")) return "Internet Explorer";
  return "Unknown";
}

function device(ua) {
  if (ua.includes("iPad") || ua.includes("Tablet") || (ua.includes("Android") && !ua.includes("Mobile"))) return "tablet";
  if (ua.includes("Mobi") || ua.includes("iPhone") || ua.includes("iPod")) return "mobile";
  return "desktop";
}

function parseUserAgent(raw) {
  const ua = typeof raw === "string" ? raw.slice(0, MAX_LENGTH) : "";
  if (!ua) return { device: "unknown", browser: "Unknown", os: "Unknown" };
  if (BOT.test(ua)) return { device: "bot", browser: "Bot", os: "Unknown" };
  return { device: device(ua), browser: browser(ua), os: operatingSystem(ua) };
}

module.exports = { parseUserAgent };
