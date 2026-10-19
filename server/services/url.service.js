const Url = require("../models/url.model");
const { AppError, ConflictError, GoneError, NotFoundError } = require("../utils/errors");
const codes = require("../utils/shortCode");
const escapeRegex = require("../utils/escapeRegex");

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
      // random code collided: loop and try a new one
    }
  }
  throw new AppError(500, "CODE_GENERATION_FAILED", "Could not generate a unique code, please retry");
}


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

const MANAGEABLE_STATUSES = ["active", "disabled", null]; // null: links that predate `status`

function manageableBy(actor, id) {
  const filter = { _id: id, status: { $in: MANAGEABLE_STATUSES } };
  if (actor.role !== "ADMIN") filter.user = actor._id;
  return filter;
}

// "Not yours" and "doesn't exist" must be INDISTINGUISHABLE. A 403 ("exists, but
// not yours") would let anyone probe ids and learn which links exist.
const linkNotFound = () => new NotFoundError("Link not found", "LINK_NOT_FOUND");

async function getUrlFor(actor, id) {
  const url = await Url.findOne(manageableBy(actor, id), null, { lean: true });
  if (!url) throw linkNotFound();
  return url;
}


const EDITABLE_FIELDS = ["originalUrl", "status", "expiresAt"];

async function updateUrlFor(actor, id, changes) {
  const $set = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in changes) $set[field] = changes[field];
  }

  const url = await Url.findOneAndUpdate(
    manageableBy(actor, id), // check and change in ONE atomic operation
    { $set },
    { returnDocument: "after", runValidators: true, lean: true } // update validators are OFF by default in Mongoose
  );
  if (!url) throw linkNotFound();
  return url;
}

// Soft delete: the row stays, so the short code can never be reissued to someone
// else. The redirect answers 410 Gone from now on.
async function deleteUrlFor(actor, id) {
  const url = await Url.findOneAndUpdate(
    manageableBy(actor, id),
    { $set: { status: "deleted" } },
    { returnDocument: "after", lean: true }
  );
  if (!url) throw linkNotFound();
}


const SORTABLE = { createdAt: "createdAt", updatedAt: "updatedAt", clicks: "clicks", lastClickedAt: "lastClickedAt" };

function listFilter(actor, { status, search }, now) {
  const filter = { user: actor._id };
  const and = [];

  if (status === "disabled") {
    filter.status = "disabled";
  } else if (status === "active") {
    filter.status = { $in: ["active", null] };
    and.push({ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });
  } else if (status === "expired") {
    filter.status = { $in: ["active", null] };
    filter.expiresAt = { $lte: now }; // links with no expiry (null) are not matched
  } else {
    filter.status = { $in: MANAGEABLE_STATUSES };
  }

  if (search) {
    // a case-insensitive "contains" match on either the code or the destination
    const contains = new RegExp(escapeRegex(search), "i");
    and.push({ $or: [{ shortCode: contains }, { originalUrl: contains }] });
  }

  if (and.length > 0) filter.$and = and;
  return filter;
}

// One page of the caller's links, plus how many there are in total.
async function listUrlsFor(actor, { page, limit, sort, order, status, search }) {
  const filter = listFilter(actor, { status, search }, new Date());
  const direction = order === "asc" ? 1 : -1;

  // `_id` is a tie-breaker. Many links can share a click count; without a
  // fully determined order the database may arrange equal rows differently
  // from one request to the next, and a link could appear on two pages or none.
  const sortSpec = { [SORTABLE[sort] ?? "createdAt"]: direction, _id: direction };

  const [items, total] = await Promise.all([
    Url.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).lean(),
    Url.countDocuments(filter),
  ]);

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = { createShortUrl, resolveShortCode, getUrlFor, updateUrlFor, deleteUrlFor, listUrlsFor };
