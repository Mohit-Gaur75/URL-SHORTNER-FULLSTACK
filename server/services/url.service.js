const Url = require("../models/url.model");
const { AppError, ConflictError, GoneError, NotFoundError } = require("../utils/errors");
const codes = require("../utils/shortCode");
const escapeRegex = require("../utils/escapeRegex");
const { recordClick } = require("./clickRecorder");

const MAX_RANDOM_ATTEMPTS = 5;

// MongoDB error 11000 = "duplicate key": the unique index refused the insert.
// For links there is only one unique index (shortCode), but we check which
// one anyway so that an unrelated duplicate is never mistaken for a collision.
const isShortCodeCollision = (err) =>
  err.code === 11000 && (!err.keyPattern || "shortCode" in err.keyPattern);

// A random code that happens to spell a reserved word (e.g. "Support") is
// thrown away and regenerated. Astronomically rare, but then it's a bug.
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

// A link may be followed only if it is active AND not expired.
// - status uses an ALLOW-LIST ("active" and nothing else), so a status we add
//   later (say "blocked") is refused by default instead of redirecting.
//   `null` also matches links that predate the status field.
// - `expiresAt: null` matches "never expires", including documents that don't
//   have the field at all.
// The shortCode equality is answered by the unique index; the other conditions
// are checked on the one document that index finds.
function liveLinkFilter(code, now) {
  return {
    shortCode: code,
    status: { $in: ["active", null] },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
}

// The link exists but can't be followed (or doesn't exist). Pick the answer.
//   permanently ended on purpose (deleted, expired) → 410 Gone
//   paused by its owner (disabled)                  → 404, it may come back
//   anything else                                   → 404, including a status
//                                                     value we don't recognize
function whyUnavailable(link, now) {
  if (!link) return new NotFoundError("URL not found", "URL_NOT_FOUND");
  if (link.status === "deleted") return new GoneError("This link has been deleted", "LINK_DELETED");
  if (link.status === "disabled") return new NotFoundError("This link is currently disabled", "LINK_DISABLED");
  if ((link.status === "active" || link.status == null) && link.expiresAt && link.expiresAt <= now) {
    return new GoneError("This link has expired", "LINK_EXPIRED");
  }
  return new NotFoundError("URL not found", "URL_NOT_FOUND");
}

// Returns the destination for a short code, or throws why it can't be followed.
//
// HOT PATH. One database round trip when the link is live:
//   findOneAndUpdate(live link, +1 click)  → the destination
// Only when that finds nothing do we do a second, rare read to learn WHY.
//
// countClick=false is for HEAD requests ("what would a GET do?"): the same
// lookup, without the write.
// `context` ({ userAgent, referrer, doNotTrack }) is what the controller knows about the visitor;
// when given, a successful visit is also recorded as an analytics event.
async function resolveShortCode(code, { countClick = true, context } = {}) {
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
  if (link) {
    if (countClick && context) recordClick(link._id, context); // fire and forget: never awaited
    return link.originalUrl;
  }

  // Query 2 (slow path only): the link didn't qualify. Why?
  // Reads just the two fields needed to decide, through the same unique index.
  const existing = await Url.findOne(
    { shortCode: code },
    { status: 1, expiresAt: 1, _id: 0 },
    { lean: true }
  );
  throw whyUnavailable(existing, now);
}

// ---------------------------------------------------------------- managing a link
//
// AUTHORIZATION = "is THIS person allowed to do THIS to THIS object?"
// (Authentication, Phase 8, only answered "who is this?".)
//
// The rule, in one place:
//   - an ADMIN may manage any link
//   - everyone else may manage only links they own
//   - ownerless links (anonymous, or created before accounts) belong to no user,
//     so only an admin can manage them
//   - deleted links can't be managed by anyone (they're gone to the outside world)
//
// The rule is applied INSIDE the database query. The database can only ever hand
// back, or change, a link this person may manage. There is no separate
// "load it, then check" step that someone could forget, or that another request
// could slip through between the two steps.
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

// Only these fields may ever be changed through the API. (The request is
// validated first, but a service must not trust its caller.)
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

// ---------------------------------------------------------------- listing

// What the client may sort by, mapped to the real field. (Zod already restricts
// this; a service must not trust its caller.)
const SORTABLE = { createdAt: "createdAt", updatedAt: "updatedAt", clicks: "clicks", lastClickedAt: "lastClickedAt" };

// Builds the database filter for "my links". It ALWAYS starts with
// { user: actor._id }: listing is never allowed to see anyone else's links.
//
//   active   → on and not expired
//   expired  → on, but its expiry date has passed
//   disabled → switched off by the owner
//   all      → everything that isn't deleted
// Deleted links are never listed.
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
