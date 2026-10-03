const Url = require("../models/url.model");
const { AppError, ConflictError, GoneError, NotFoundError } = require("../utils/errors");
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

// The unique index on shortCode is the real guarantee. We never "check, then
// insert": between the check and the insert another request can take the same
// code. We insert, and react if MongoDB says the code was taken.
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
      // random code collided: loop and try a new one
    }
  }
  throw new AppError(500, "CODE_GENERATION_FAILED", "Could not generate a unique code, please retry");
}

// ---------------------------------------------------------------- redirect

function liveLinkFilter(code, now) {
  return {
    shortCode: code,
    status: { $in: ["active", null] },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

function whyUnavailable(link, now) {
  if (!link) return new NotFoundError("URL not found", "URL_NOT_FOUND");
  if (link.status === "deleted") return new GoneError("This link has been deleted", "LINK_DELETED");
  if (link.status === "disabled") return new NotFoundError("This link is currently disabled", "LINK_DISABLED");
  if ((link.status === "active" || link.status == null) && link.expiresAt && link.expiresAt <= now) {
    return new GoneError("This link has expired", "LINK_EXPIRED");
  }
  return new NotFoundError("URL not found", "URL_NOT_FOUND");
}

async function resolveShortCode(code, { countClick = true } = {}) {
  // Junk like "favicon.ico" never touches the database
  if (!codes.isValidCode(code)) throw new NotFoundError("URL not found", "URL_NOT_FOUND");

  const now = new Date();
  const filter = liveLinkFilter(code, now);

  // Query 1: find the live link and count the click in ONE atomic operation.
  // - `lean: true` returns a plain object instead of building a full Mongoose
  //   document (getters, change tracking...) that we would throw away.
  // - `timestamps: false`: without it Mongoose would also bump `updatedAt` on
  //   every click, and updatedAt would stop meaning "last edited".
  const link = countClick
    ? await Url.findOneAndUpdate(
        filter,
        { $inc: { clicks: 1 }, $set: { lastClickedAt: now } },
        { timestamps: false, lean: true }
      )
    : await Url.findOne(filter, { originalUrl: 1, _id: 0 }, { lean: true });
  if (link) return link.originalUrl;

  // Query 2 (slow path only): the link didn't qualify. Why?
  // Reads just the two fields needed to decide, through the same unique index.
  const existing = await Url.findOne(
    { shortCode: code },
    { status: 1, expiresAt: 1, _id: 0 },
    { lean: true }
  );
  throw whyUnavailable(existing, now);
}

module.exports = { createShortUrl, resolveShortCode };
