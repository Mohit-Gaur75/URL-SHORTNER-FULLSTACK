const { z } = require("zod");
const env = require("../config/env");
const { isValidCode, isReserved } = require("../utils/shortCode");
const { isoDate, bodyTypeError } = require("./common");

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

        expiresAt: expiresAt.optional(),
    },
    { error: bodyTypeError }
  )
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update");

module.exports = { createUrlBody, updateUrlBody };
