const { z } = require("zod");
const { idParams, isoDate, bodyTypeError } = require("./common");

const createApiKeyBody = z.strictObject(
  {
    name: z
      .string({ error: "Name is required" })
      .trim()
      .min(1, "Name cannot be empty")
      .max(60, "Name cannot exceed 60 characters"),
    expiresAt: isoDate
      .refine((date) => date > new Date(), "Expiry must be in the future")
      .nullable()
      .optional(),
  },
  { error: bodyTypeError }
);

module.exports = { createApiKeyBody, idParams };
