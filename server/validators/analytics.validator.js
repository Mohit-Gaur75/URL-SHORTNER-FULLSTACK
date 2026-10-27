const { z } = require("zod");
const { isoDate, paginationQuery } = require("./common");

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

const isTimeZone = (name) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
};

// "Asia/Kolkata", "America/New_York", "UTC"...  Days and weeks start at midnight
// IN THIS ZONE, so a visitor-facing chart shows days the way the owner lives them.
const timezone = z
  .string({ error: "timezone must be text" })
  .trim()
  .max(64, "timezone is too long")
  .refine(isTimeZone, "Unknown time zone. Use an IANA name such as Asia/Kolkata, or UTC")
  .default("UTC");

const noReversedRange = (q) => !(q.from && q.to) || q.from <= q.to;
const noHugeRange = (q) => !(q.from && q.to) || q.to - q.from <= MAX_RANGE_MS;

// Used by /analytics/summary and /analytics/timeseries. Bounding the date range bounds
// how much data a single request can make the database aggregate. (`interval` only
// matters to the time series; the summary ignores it.)
const analyticsQuery = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    interval: z
      .enum(["hour", "day", "week", "month"], {
        error: "interval must be one of: hour, day, week, month",
      })
      .default("day"),
    timezone,
  })
  .refine(noReversedRange, { message: "'from' must not be after 'to'", path: ["from"] })
  .refine(noHugeRange, { message: "Date range can be at most 366 days", path: ["to"] });

// Used by GET /analytics (the raw list of recent clicks): paging plus an optional range.
const eventsQuery = paginationQuery
  .extend({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(noReversedRange, { message: "'from' must not be after 'to'", path: ["from"] })
  .refine(noHugeRange, { message: "Date range can be at most 366 days", path: ["to"] });

module.exports = { analyticsQuery, eventsQuery };
