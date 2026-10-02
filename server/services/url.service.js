const Url = require("../models/url.model");
const { AppError, ConflictError, NotFoundError } = require("../utils/errors");
const { generate, isValidCode } = require("../utils/shortCode");

const MAX_RANDOM_ATTEMPTS = 5;

// The unique index on shortCode is the real guarantee. We never "check, then
// insert": we insert and react if MongoDB says the code is already taken.
async function createShortUrl({ originalUrl, customCode }) {
  const isCustom = Boolean(customCode);
  const attempts = isCustom ? 1 : MAX_RANDOM_ATTEMPTS;

  for (let i = 0; i < attempts; i++) {
    try {
      return await Url.create({
        originalUrl,
        shortCode: isCustom ? customCode : generate(),
      });
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000 = duplicate key (unique index)
      if (isCustom) throw new ConflictError("That short code is already taken", "SHORT_CODE_TAKEN");
      // random code collided: loop and try a new one
    }
  }
  throw new AppError(500, "CODE_GENERATION_FAILED", "Could not generate a unique code, please retry");
}

// Returns the destination URL and counts the click, or throws 404.
async function resolveShortCode(code) {
  // Junk like "favicon.ico" never touches the database
  if (!isValidCode(code)) throw new NotFoundError("URL not found", "URL_NOT_FOUND");

  // Find and increment in ONE atomic operation
  const url = await Url.findOneAndUpdate(
    { shortCode: code },
    { $inc: { clicks: 1 } }
  );
  if (!url) throw new NotFoundError("URL not found", "URL_NOT_FOUND");
  return url.originalUrl;
}

module.exports = { createShortUrl, resolveShortCode };
