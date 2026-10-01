const { z } = require("zod");

// A MongoDB ObjectId is 24 hex characters. Checking the shape here means a
// malformed :id is rejected before it can reach Mongoose and throw a CastError.
const objectId = z
  .string({ error: "Invalid id" })
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

const idParams = z.object({ id: objectId });

// Query-string values always arrive as strings, so we coerce to numbers.
// Every limit has an upper bound: "no limit" is how one request loads
// 100,000 rows into memory.
const paginationQuery = z.object({
  page: z.coerce
    .number({ error: "page must be a number" })
    .int("page must be a whole number")
    .min(1, "page must be at least 1")
    .max(10000, "page is too large")
    .default(1),
  limit: z.coerce
    .number({ error: "limit must be a number" })
    .int("limit must be a whole number")
    .min(1, "limit must be at least 1")
    .max(100, "limit can be at most 100")
    .default(20),
});

// Accepts "2026-01-31" or "2026-01-31T10:00:00Z" (with or without an offset).
// Rejects loose strings like "yesterday" or "123" that `new Date()` would
// happily turn into some random date.
const isoDate = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()], {
    error: "Must be an ISO date, e.g. 2026-01-31 or 2026-01-31T10:00:00Z",
  })
  .transform((value) => new Date(value));

// Message for a body that isn't a JSON object at all (e.g. an array or a
// string). It must NOT replace Zod's other messages, such as the one naming
// an unrecognized field, so we only apply it to type errors.
const bodyTypeError = (issue) =>
  issue.code === "invalid_type" ? "Request body must be a JSON object" : undefined;

module.exports = { objectId, idParams, paginationQuery, isoDate, bodyTypeError };
