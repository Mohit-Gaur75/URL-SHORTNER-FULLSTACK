const { z } = require("zod");
const { isoDate } = require("./common");

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

// Used by the analytics endpoints in Phase 13. Bounding the date range bounds
// how much data a single request can make the database aggregate.
const analyticsQuery = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    interval: z
      .enum(["hour", "day", "week", "month"], {
        error: "interval must be one of: hour, day, week, month",
      })
      .default("day"),
  })
  .refine((q) => !(q.from && q.to) || q.from <= q.to, {
    message: "'from' must not be after 'to'",
    path: ["from"],
  })
  .refine((q) => !(q.from && q.to) || q.to - q.from <= MAX_RANGE_MS, {
    message: "Date range can be at most 366 days",
    path: ["to"],
  });

module.exports = { analyticsQuery };
