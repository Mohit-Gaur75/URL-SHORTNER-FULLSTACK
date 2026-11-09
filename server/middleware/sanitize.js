/**
 * Recursive sanitization to defend against NoSQL operator injection
 * and prototype pollution attacks.
 * Strips any object key starting with '$', containing '.', or matching prototype keywords.
 */
function sanitizeObject(target) {
  if (!target || typeof target !== "object") return target;

  if (Array.isArray(target)) {
    return target.map(sanitizeObject);
  }

  const clean = {};
  for (const [key, value] of Object.entries(target)) {
    // 1. Block MongoDB operator injection (e.g. { $ne: null }, { $gt: "" })
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }

    // 2. Block prototype pollution attacks
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }

    clean[key] = typeof value === "object" ? sanitizeObject(value) : value;
  }
  return clean;
}

function sanitize(req, res, next) {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
}

module.exports = { sanitize, sanitizeObject };
