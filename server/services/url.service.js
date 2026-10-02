const Url = require("../models/url.model");
const { AppError, ConflictError, NotFoundError } = require("../utils/errors");
const { generate, isValidCode } = require("../utils/shortCode");

const MAX_RANDOM_ATTEMPTS = 5;

async function createShortUrl({ originalUrl, customCode, userId = null }) {
  const isCustom = Boolean(customCode);
  const attempts = isCustom ? 1 : MAX_RANDOM_ATTEMPTS;

  for (let i = 0; i < attempts; i++) {
    try {
      return await Url.create({
        user: userId,
        originalUrl,
        shortCode: isCustom ? customCode : generate(),
        isCustomAlias: isCustom,
      });
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000 = duplicate key (unique index)
      if (isCustom) throw new ConflictError("That short code is already taken", "SHORT_CODE_TAKEN");

    }
  }
  throw new AppError(500, "CODE_GENERATION_FAILED", "Could not generate a unique code, please retry");
}

async function resolveShortCode(code) {
 
  if (!isValidCode(code)) throw new NotFoundError("URL not found", "URL_NOT_FOUND");

  
  const url = await Url.findOneAndUpdate(
    { shortCode: code },
    { $inc: { clicks: 1 }, $set: { lastClickedAt: new Date() } },
    { timestamps: false }
  );
  if (!url) throw new NotFoundError("URL not found", "URL_NOT_FOUND");
  return url.originalUrl;
}

module.exports = { createShortUrl, resolveShortCode };
