const HttpError = require("../utils/HttpError");
const { isValidCode, isReserved } = require("../utils/shortCode");

module.exports = (req, res, next) => {
  const { originalUrl, customCode } = req.body;

  if (!originalUrl || typeof originalUrl !== "string") {
    throw new HttpError(400, "URL is required");
  }
  if (originalUrl.length > 2048) {
    throw new HttpError(400, "URL is too long");
  }

  let parsed;
  try {
    parsed = new URL(originalUrl.trim());
  } catch {
    throw new HttpError(400, "Invalid URL format");
  }

  // Only http/https, so `javascript:` or `file:` links can never be stored
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, "Only http and https URLs are allowed");
  }

  // Prevent redirect loops: shortening a link that points at ourselves
  if (process.env.BASE_URL && parsed.host === new URL(process.env.BASE_URL).host) {
    throw new HttpError(400, "You can't shorten a link to this service");
  }

  if (customCode !== undefined && customCode !== "") {
    if (typeof customCode !== "string" || !isValidCode(customCode)) {
      throw new HttpError(400, "Custom code must be 3–30 characters: letters, numbers, - or _");
    }
    if (isReserved(customCode)) {
      throw new HttpError(400, "That custom code is reserved");
    }
  }

  req.body.originalUrl = parsed.href; // normalized form
  next();
};