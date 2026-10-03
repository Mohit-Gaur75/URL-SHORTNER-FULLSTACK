const Url = require("../models/url.model");
const { AppError, ConflictError, NotFoundError } = require("../utils/errors");
const codes = require("../utils/shortCode");

const MAX_RANDOM_ATTEMPTS = 5;

const isShortCodeCollision = (err) =>
  err.code === 11000 && (!err.keyPattern || "shortCode" in err.keyPattern);

function newRandomCode() {
  let code;
  do {
    code = codes.generate();
  } while (codes.isReserved(code));
  return code;
}

const sameInstant = (a, b) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

// The alias is taken. Two very different situations look identical here:
//   1. someone ELSE owns it                      → 409, the alias is taken
//   2. YOU already created exactly this link     → your first request worked and
//      (same owner, destination and expiry)        you are retrying it (timeout,
//                                                  double-click): return the same
//                                                  link instead of an error
// That makes retrying the request safe. This is called idempotency.
async function replayOrConflict({ customCode, originalUrl, expiresAt, userId }) {
  if (userId) {
    const existing = await Url.findOne({ shortCode: customCode });
    if (
      existing &&
      existing.user &&
      String(existing.user) === String(userId) &&
      existing.status !== "deleted" &&
      existing.originalUrl === originalUrl &&
      sameInstant(existing.expiresAt, expiresAt)
    ) {
      return { url: existing, created: false };
    }
  }
  throw new ConflictError("That short code is already taken", "SHORT_CODE_TAKEN");
}

async function createShortUrl({ originalUrl, customCode, expiresAt = null, userId = null }) {
  const isCustom = Boolean(customCode);
  const attempts = isCustom ? 1 : MAX_RANDOM_ATTEMPTS;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const url = await Url.create({
        user: userId,
        originalUrl,
        shortCode: isCustom ? customCode : newRandomCode(),
        isCustomAlias: isCustom,
        expiresAt,
      });
      return { url, created: true };
    } catch (err) {
      if (!isShortCodeCollision(err)) throw err;
      if (isCustom) return replayOrConflict({ customCode, originalUrl, expiresAt, userId });
    }
  }
  throw new AppError(500, "CODE_GENERATION_FAILED", "Could not generate a unique code, please retry");
}

async function resolveShortCode(code) {
  if (!codes.isValidCode(code)) throw new NotFoundError("URL not found", "URL_NOT_FOUND");

  const now = new Date();

  const url = await Url.findOneAndUpdate(
    { shortCode: code, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    { $inc: { clicks: 1 }, $set: { lastClickedAt: now } },
    { timestamps: false }
  );
  if (!url) throw new NotFoundError("URL not found", "URL_NOT_FOUND");
  return url.originalUrl;
}

module.exports = { createShortUrl, resolveShortCode };
