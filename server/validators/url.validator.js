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

const tagItem = z
  .string({ error: "Tag must be text" })
  .trim()
  .toLowerCase()
  .min(1, "Tag cannot be empty")
  .max(30, "Tag cannot exceed 30 characters")
  .regex(/^[a-z0-9_-]+$/, "Tags can only contain lowercase letters, numbers, hyphens, and underscores");

const tags = z.preprocess((val) => {
  if (Array.isArray(val)) {
    return Array.from(new Set(val.map((t) => (typeof t === "string" ? t.trim().toLowerCase() : t))));
  }
  return val;
}, z.array(tagItem).max(10, "You can specify at most 10 tags").optional());

const maxClicks = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v === null ? null : Number(v)),
  z.number().int("Max clicks must be an integer").min(1, "Max clicks must be at least 1").nullable().optional()
);

const expiredRedirectUrl = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v === null ? null : v),
  originalUrl.nullable().optional()
);

const createUrlBody = z.strictObject(
  {
    originalUrl,
    customCode,
    expiresAt: expiresAt.optional(),
    tags: tags.optional(),
    maxClicks: maxClicks.optional(),
    expiredRedirectUrl: expiredRedirectUrl.optional(),
  },
  { error: bodyTypeError }
);

const updateUrlBody = z
  .strictObject(
    {
      originalUrl: originalUrl.optional(),
      status: z
        .enum(["active", "disabled"], {
          error: "Status must be 'active' or 'disabled'",
        })
        .optional(),
      isArchived: z.boolean().optional(),
      expiresAt: expiresAt.optional(),
      tags: tags.optional(),
      maxClicks: maxClicks.optional(),
      expiredRedirectUrl: expiredRedirectUrl.optional(),
    },
    { error: bodyTypeError }
  )
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update");

// GET /api/urls?page=2&limit=20&sort=clicks&order=desc&status=active&search=promo&tag=marketing
const SORT_FIELDS = ["createdAt", "updatedAt", "clicks", "lastClickedAt"];

const listUrlsQuery = paginationQuery.extend({
  sort: z
    .enum(SORT_FIELDS, { error: `sort must be one of: ${SORT_FIELDS.join(", ")}` })
    .default("createdAt"),
  order: z.enum(["asc", "desc"], { error: "order must be asc or desc" }).default("desc"),
  status: z
    .enum(["all", "active", "disabled", "expired", "archived", "deleted"], {
      error: "status must be one of: all, active, disabled, expired, archived, deleted",
    })
    .default("all"),
  tag: z
    .string({ error: "tag must be text" })
    .trim()
    .toLowerCase()
    .max(30, "tag can be at most 30 characters")
    .optional(),
  search: z
    .string({ error: "search must be text" })
    .trim()
    .max(100, "search can be at most 100 characters")
    .optional()
    .transform((value) => value || undefined), // "" means no search
});

const bulkCreateUrlBody = z.strictObject(
  {
    urls: z
      .array(
        z.strictObject(
          {
            originalUrl,
            customCode: customCode.optional(),
            expiresAt: expiresAt.optional(),
            tags: tags.optional(),
            maxClicks: maxClicks.optional(),
            expiredRedirectUrl: expiredRedirectUrl.optional(),
          },
          { error: bodyTypeError }
        )
      )
      .min(1, "Provide at least one URL")
      .max(50, "You can shorten at most 50 URLs in one batch"),
  },
  { error: bodyTypeError }
);

module.exports = { createUrlBody, updateUrlBody, listUrlsQuery, bulkCreateUrlBody };
