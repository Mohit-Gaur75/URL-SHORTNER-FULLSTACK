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

    // Only http/https, so `javascript:` or `file:` links can never be stored
    if (!["http:", "https:"].includes(parsed.protocol)) {
      ctx.addIssue({ code: "custom", message: "Only http and https URLs are allowed" });
      return z.NEVER;
    }

    // Prevent redirect loops: shortening a link that points at ourselves
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

const createUrlBody = z.strictObject(
  { originalUrl, customCode },
  { error: bodyTypeError }
);

// Used by PATCH /api/urls/:id in Phase 11.
// The short code itself is deliberately NOT editable: links already shared
// in the wild must keep working. `strictObject` rejects it if someone tries.
const updateUrlBody = z
  .strictObject(
    {
      originalUrl: originalUrl.optional(),
      status: z
        .enum(["active", "disabled"], { error: "Status must be 'active' or 'disabled'" })
        .optional(),
      // null removes the expiry; a date sets one
      expiresAt: isoDate
        .refine((d) => d > new Date(), "Expiry must be in the future")
        .nullable()
        .optional(),
    },
    { error: bodyTypeError }
  )
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update");

module.exports = { createUrlBody, updateUrlBody };
