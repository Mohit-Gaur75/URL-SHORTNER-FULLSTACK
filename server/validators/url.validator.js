const { z } = require("zod");
const env = require("../config/env");
const { isValidCode, isReserved } = require("../utils/shortCode");
const { isoDate, bodyTypeError, paginationQuery } = require("./common");

const OWN_HOST = new URL(env.baseUrl).host;

const originalUrl = z
  .string({ error: "URL is required" })
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL is too long")
  // Runs only if the checks above passed.
  .transform((value, ctx) => {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid URL format" });
      return z.NEVER;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      ctx.addIssue({ code: "custom", message: "Only http and https URLs are allowed" });
      return z.NEVER;
    }

    // https://user:password@host/ is a classic phishing trick (the real host is
    // after the @) and would also store a password in plain text.
    if (parsed.username || parsed.password) {
      ctx.addIssue({ code: "custom", message: "URLs containing a username or password are not allowed" });
      return z.NEVER;
    }

    
    if (parsed.host === OWN_HOST) {
      ctx.addIssue({ code: "custom", message: "You can't shorten a link to this service" });
      return z.NEVER;
    }

    return parsed.href; // normalized form
  });

// The form sends "" when the field is left empty, which means "no custom code".
const customCode = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string({ error: "Custom code must be a string" })
    .refine(isValidCode, "Custom code must be 3–30 characters: letters, numbers, - or _")
    .refine((code) => !isReserved(code), "That custom code is reserved")
    .optional()
);


const MAX_EXPIRY_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const expiresAt = isoDate
  .refine((date) => date > new Date(), "Expiry must be in the future")
  .refine((date) => date.getTime() - Date.now() <= MAX_EXPIRY_MS, "Expiry can be at most 5 years from now")
  .nullable();

const createUrlBody = z.strictObject(
  { originalUrl, customCode, expiresAt: expiresAt.optional() },
  { error: bodyTypeError }
);


const updateUrlBody = z
  .strictObject(
    {
      originalUrl: originalUrl.optional(),
      status: z
        .enum(["active", "disabled"], { error: "Status must be 'active' or 'disabled'" })
        .optional(),
      // null removes the expiry; a date sets one
      expiresAt: expiresAt.optional(),
    },
    { error: bodyTypeError }
  )
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update");

// GET /api/urls?page=2&limit=20&sort=clicks&order=desc&status=active&search=promo
//
// `sort` is an allow-list: the client may only sort by fields we chose. Passing
// an arbitrary field name through to the database would let anyone force
// slow, unindexed sorts.
const SORT_FIELDS = ["createdAt", "updatedAt", "clicks", "lastClickedAt"];

const listUrlsQuery = paginationQuery.extend({
  sort: z
    .enum(SORT_FIELDS, { error: `sort must be one of: ${SORT_FIELDS.join(", ")}` })
    .default("createdAt"),
  order: z.enum(["asc", "desc"], { error: "order must be asc or desc" }).default("desc"),
  status: z
    .enum(["all", "active", "disabled", "expired"], { error: "status must be one of: all, active, disabled, expired" })
    .default("all"),
  search: z
    .string({ error: "search must be text" })
    .trim()
    .max(100, "search can be at most 100 characters")
    .optional()
    .transform((value) => value || undefined), // "" means no search
});

module.exports = { createUrlBody, updateUrlBody, listUrlsQuery };
