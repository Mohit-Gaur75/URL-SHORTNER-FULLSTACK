const Url = require("../models/url.model");
const { AppError, ConflictError, GoneError, NotFoundError } = require("../utils/errors");
const codes = require("../utils/shortCode");
const escapeRegex = require("../utils/escapeRegex");
const linkCache = require("./linkCache.service");
const clickBuffer = require("./clickBuffer.service");
const { recordClick } = require("./clickRecorder");
const { hashPassword, verifyPassword } = require("../utils/password");

const MAX_RANDOM_ATTEMPTS = 5;

// MongoDB error 11000 = "duplicate key": the unique index refused the insert.
const isShortCodeCollision = (err) =>
  err.code === 11000 && (!err.keyPattern || "shortCode" in err.keyPattern);

// A random code that happens to spell a reserved word is thrown away and regenerated
function newRandomCode() {
  let code;
  do {
    code = codes.generate();
  } while (codes.isReserved(code));
  return code;
}

const sameInstant = (a, b) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

// Idempotent replay: if the same user repeats the exact same request, return the existing link
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

// Relies on database unique index as the source of truth against race conditions
async function createShortUrl({
  originalUrl,
  customCode,
  expiresAt = null,
  tags = [],
  maxClicks = null,
  expiredRedirectUrl = null,
  password = null,
  metaTitle = null,
  metaDescription = null,
  metaImage = null,
  userId = null,
}) {
  const isCustom = Boolean(customCode);
  const attempts = isCustom ? 1 : MAX_RANDOM_ATTEMPTS;
  const passwordHash = password ? await hashPassword(password) : null;
  const isPasswordProtected = Boolean(passwordHash);

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const url = await Url.create({
        user: userId,
        originalUrl,
        shortCode: isCustom ? customCode : newRandomCode(),
        isCustomAlias: isCustom,
        expiresAt,
        tags: Array.isArray(tags) ? tags : [],
        maxClicks: maxClicks ?? null,
        expiredRedirectUrl: expiredRedirectUrl ?? null,
        isPasswordProtected,
        passwordHash,
        metaTitle: metaTitle ?? null,
        metaDescription: metaDescription ?? null,
        metaImage: metaImage ?? null,
      });
      return { url, created: true };
    } catch (err) {
      if (!isShortCodeCollision(err)) throw err;
      if (isCustom) return replayOrConflict({ customCode, originalUrl, expiresAt, userId });
      // random code collided: retry with a new code
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
    $expr: {
      $or: [
        { $eq: [{ $ifNull: ["$maxClicks", null] }, null] },
        { $lt: ["$clicks", "$maxClicks"] },
      ],
    },
  };
}

function whyUnavailable(link, now) {
  if (!link) return new NotFoundError("URL not found", "URL_NOT_FOUND");
  if (link.status === "deleted") return new GoneError("This link has been deleted", "LINK_DELETED");
  if (link.status === "disabled") return new NotFoundError("This link is currently disabled", "LINK_DISABLED");

  const isExpired =
    (link.status === "active" || link.status == null) &&
    ((link.expiresAt && link.expiresAt <= now) ||
      (link.maxClicks != null && link.clicks >= link.maxClicks));

  if (isExpired) {
    if (link.expiredRedirectUrl) {
      return { redirect: link.expiredRedirectUrl };
    }
    return new GoneError("This link has expired", "LINK_EXPIRED");
  }
  return new NotFoundError("URL not found", "URL_NOT_FOUND");
}

// The slow path: a lookup found no live link (404 vs 410 distinction)
async function explainUnavailable(code, now) {
  const existing = await Url.findOne(
    { shortCode: code },
    { status: 1, expiresAt: 1, clicks: 1, maxClicks: 1, expiredRedirectUrl: 1, _id: 0 },
    { lean: true }
  );
  return whyUnavailable(existing, now);
}

// Fallback path when Redis is disabled: query MongoDB and increment click in ONE atomic operation
async function resolveFromDatabase(code, { countClick = true, context = null } = {}) {
  const now = new Date();
  const filter = liveLinkFilter(code, now);

  const link = countClick
    ? await Url.findOneAndUpdate(
        filter,
        { $inc: { clicks: 1 }, $set: { lastClickedAt: now } },
        {
          projection: { originalUrl: 1, _id: 1, clicks: 1, maxClicks: 1, isPasswordProtected: 1, passwordHash: 1 },
          timestamps: false,
          lean: true,
        }
      )
    : await Url.findOne(filter, { originalUrl: 1, _id: 0, clicks: 1, maxClicks: 1, isPasswordProtected: 1, passwordHash: 1 }, { lean: true });

  if (link) {
    if (link.isPasswordProtected) {
      if (context?.password) {
        const ok = await verifyPassword(context.password, link.passwordHash);
        if (!ok) throw new AppError(403, "PASSWORD_REQUIRED", "Incorrect password for this link");
      } else {
        throw new AppError(403, "PASSWORD_REQUIRED", "This link is password-protected");
      }
    }
    if (countClick && context) recordClick(link._id, context);
    return link.originalUrl;
  }

  const result = await explainUnavailable(code, now);
  if (result && result.redirect) return result.redirect;
  throw result;
}

// Counts a click asynchronously without delaying the visitor's HTTP redirect.
// If Redis is enabled, buffers to Redis; otherwise falls back directly to MongoDB.
function countClickInBackground(code, linkId = null, context = null) {
  clickBuffer
    .record(code)
    .then((buffered) => {
      if (buffered) return;
      const query = Url.updateOne(
        { shortCode: code, status: { $in: ["active", null] } },
        { $inc: { clicks: 1 }, $set: { lastClickedAt: new Date() } },
        { timestamps: false }
      );
      return Promise.resolve(typeof query?.exec === "function" ? query.exec() : query);
    })
    .catch((err) => {
      if (process.env.NODE_ENV !== "test") console.warn("[click-count] failed:", err.message);
    });

  if (linkId && context) {
    recordClick(linkId, context);
  }
}

// Cache-stampede protection:
// If multiple concurrent requests arrive for the same missing code,
// they all share ONE in-flight MongoDB query promise instead of hammering the DB.
const inFlightReads = new Map();

function readLiveLinkOnce(code) {
  let pending = inFlightReads.get(code);
  if (!pending) {
    const query = Url.findOne(
      liveLinkFilter(code, new Date()),
      {
        originalUrl: 1,
        expiresAt: 1,
        _id: 1,
        maxClicks: 1,
        clicks: 1,
        isPasswordProtected: 1,
        passwordHash: 1,
        metaTitle: 1,
        metaDescription: 1,
        metaImage: 1,
      },
      { lean: true }
    );
    pending = Promise.resolve(typeof query?.exec === "function" ? query.exec() : query)
      .finally(() => inFlightReads.delete(code));
    inFlightReads.set(code, pending);
  }
  return pending;
}

/**
 * Resolves a short code to its destination URL.
 * 1. Checks Redis cache.
 * 2. On miss, reads MongoDB and sets Redis.
 * 3. On un-live link, resolves reason (404 vs 410) without caching.
 */
async function resolveShortCode(code, { countClick = true, context = null } = {}) {
  // Discard junk codes (e.g. favicon.ico) before touching cache or DB
  if (!codes.isValidCode(code)) throw new NotFoundError("URL not found", "URL_NOT_FOUND");

  if (!linkCache.isEnabled()) return resolveFromDatabase(code, { countClick, context });

  // 1. Cache hit: instant response, zero database read
  const cached = await linkCache.get(code);
  if (cached) {
    // If the cached link has a click cap or is password protected, fallback to database resolution
    if (cached.maxClicks == null && !cached.isPasswordProtected) {
      if (countClick) countClickInBackground(code, cached.id, context);
      return cached.originalUrl;
    }
  }

  // 2. Cache miss: read MongoDB (coalesced via single-flight pattern)
  const link = await readLiveLinkOnce(code);
  if (link) {
    if (link.isPasswordProtected) {
      if (context?.password) {
        const ok = await verifyPassword(context.password, link.passwordHash);
        if (!ok) throw new AppError(403, "PASSWORD_REQUIRED", "Incorrect password for this link");
      } else {
        throw new AppError(403, "PASSWORD_REQUIRED", "This link is password-protected");
      }
    }
    if (context?.meta) {
      context.meta.title = link.metaTitle;
      context.meta.description = link.metaDescription;
      context.meta.image = link.metaImage;
    }
    if (link.maxClicks == null && !link.isPasswordProtected) {
      linkCache.set(code, link.originalUrl, link.expiresAt, link._id); // non-blocking cache write
    }
    if (countClick) countClickInBackground(code, link._id, context);
    return link.originalUrl;
  }

  // 3. Not live: disabled, deleted, expired, archived, or non-existent (never cached)
  const result = await explainUnavailable(code, new Date());
  if (result && result.redirect) return result.redirect;
  throw result;
}

async function verifyLinkPassword(code, password, { context = null } = {}) {
  if (!codes.isValidCode(code)) throw new NotFoundError("URL not found", "URL_NOT_FOUND");
  const now = new Date();
  const link = await Url.findOne(
    { shortCode: code, status: { $in: ["active", null] } },
    { originalUrl: 1, _id: 1, isPasswordProtected: 1, passwordHash: 1, expiresAt: 1, maxClicks: 1, clicks: 1 }
  ).lean();

  if (!link) {
    const unavailable = await explainUnavailable(code, now);
    if (unavailable?.redirect) return { success: true, redirectUrl: unavailable.redirect };
    throw unavailable;
  }

  if (link.isPasswordProtected && link.passwordHash) {
    const isValid = await verifyPassword(password, link.passwordHash);
    if (!isValid) {
      throw new AppError(401, "INVALID_PASSWORD", "Incorrect password");
    }
  }

  countClickInBackground(code, link._id, context);
  return { success: true, redirectUrl: link.originalUrl };
}

// ---------------------------------------------------------------- managing a link

const MANAGEABLE_STATUSES = ["active", "disabled", null];

function manageableBy(actor, id) {
  const filter = { _id: id, status: { $in: MANAGEABLE_STATUSES } };
  if (actor.role !== "ADMIN") filter.user = actor._id;
  return filter;
}

const linkNotFound = () => new NotFoundError("Link not found", "LINK_NOT_FOUND");

async function getUrlFor(actor, id) {
  const url = await Url.findOne(manageableBy(actor, id), null, { lean: true });
  if (!url) throw linkNotFound();
  return url;
}

const EDITABLE_FIELDS = [
  "originalUrl",
  "status",
  "expiresAt",
  "isArchived",
  "tags",
  "maxClicks",
  "expiredRedirectUrl",
  "metaTitle",
  "metaDescription",
  "metaImage",
];

async function updateUrlFor(actor, id, changes) {
  const $set = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in changes) $set[field] = changes[field];
  }

  if ("password" in changes) {
    if (changes.password) {
      $set.passwordHash = await hashPassword(changes.password);
      $set.isPasswordProtected = true;
    } else {
      $set.passwordHash = null;
      $set.isPasswordProtected = false;
    }
  }

  const url = await Url.findOneAndUpdate(
    manageableBy(actor, id),
    { $set },
    { returnDocument: "after", runValidators: true, lean: true }
  );
  if (!url) throw linkNotFound();
  await linkCache.invalidate(url.shortCode); // purge stale cache entry
  return url;
}

async function deleteUrlFor(actor, id) {
  const url = await Url.findOneAndUpdate(
    manageableBy(actor, id),
    { $set: { status: "deleted" } },
    { returnDocument: "after", lean: true }
  );
  if (!url) throw linkNotFound();
  await linkCache.invalidate(url.shortCode); // immediately stop redirects
  return url;
}

async function restoreUrlFor(actor, id) {
  const filter = { _id: id };
  if (actor.role !== "ADMIN") filter.user = actor._id;
  const url = await Url.findOneAndUpdate(
    filter,
    { $set: { status: "active", isArchived: false } },
    { returnDocument: "after", runValidators: true, lean: true }
  );
  if (!url) throw linkNotFound();
  await linkCache.invalidate(url.shortCode);
  return url;
}

async function findExistingByOriginalUrl({ originalUrl, userId }) {
  if (!userId) return null;
  try {
    return await Url.findOne(
      { user: userId, originalUrl, status: { $in: ["active", null] } },
      { shortCode: 1, originalUrl: 1, createdAt: 1, clicks: 1 }
    ).lean();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- listing

const SORTABLE = { createdAt: "createdAt", updatedAt: "updatedAt", clicks: "clicks", lastClickedAt: "lastClickedAt" };

function listFilter(actor, { status, search, tag }, now) {
  const filter = { user: actor._id };
  const and = [];

  if (status === "disabled") {
    filter.status = "disabled";
  } else if (status === "archived") {
    filter.status = "archived";
  } else if (status === "deleted") {
    filter.status = "deleted";
  } else if (status === "active") {
    filter.status = { $in: ["active", null] };
    and.push({ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });
    and.push({
      $expr: {
        $or: [
          { $eq: [{ $ifNull: ["$maxClicks", null] }, null] },
          { $lt: ["$clicks", "$maxClicks"] },
        ],
      },
    });
  } else if (status === "expired") {
    filter.status = { $in: ["active", null] };
    and.push({
      $or: [
        { expiresAt: { $lte: now } },
        {
          $and: [
            { maxClicks: { $ne: null } },
            { $expr: { $gte: ["$clicks", "$maxClicks"] } },
          ],
        },
      ],
    });
  } else {
    // "all": active, disabled, archived (excludes deleted by default)
    filter.status = { $in: MANAGEABLE_STATUSES };
  }

  if (tag) {
    and.push({ tags: tag.toLowerCase() });
  }

  if (search) {
    const contains = new RegExp(escapeRegex(search), "i");
    and.push({
      $or: [
        { shortCode: contains },
        { originalUrl: contains },
        { tags: contains },
      ],
    });
  }

  if (and.length > 0) filter.$and = and;
  return filter;
}

async function listUrlsFor(actor, { page, limit, sort, order, status, search, tag }) {
  const filter = listFilter(actor, { status, search, tag }, new Date());
  const direction = order === "asc" ? 1 : -1;
  const sortSpec = { [SORTABLE[sort] ?? "createdAt"]: direction, _id: direction };

  const [items, total] = await Promise.all([
    Url.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).lean(),
    Url.countDocuments(filter),
  ]);

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function bulkCreateShortUrls({ items, userId }) {
  const results = [];
  for (const item of items) {
    try {
      const { url, created } = await createShortUrl({
        originalUrl: item.originalUrl,
        customCode: item.customCode,
        expiresAt: item.expiresAt,
        tags: item.tags,
        maxClicks: item.maxClicks,
        expiredRedirectUrl: item.expiredRedirectUrl,
        userId,
      });
      results.push({ success: true, url, created, originalUrl: item.originalUrl });
    } catch (err) {
      results.push({ success: false, originalUrl: item.originalUrl, error: err.message });
    }
  }
  return results;
}

module.exports = {
  createShortUrl,
  bulkCreateShortUrls,
  resolveShortCode,
  verifyLinkPassword,
  getUrlFor,
  updateUrlFor,
  deleteUrlFor,
  restoreUrlFor,
  findExistingByOriginalUrl,
  listUrlsFor,
};
