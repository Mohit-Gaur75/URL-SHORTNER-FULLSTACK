const ClickEvent = require("../models/clickEvent.model");
const { getUrlFor } = require("./url.service");
const { AppError, ValidationError } = require("../utils/errors");

const DAY = 24 * 60 * 60 * 1000;
const TOP_N = 10;

// If the caller gives no range we pick a sensible window for the chosen granularity.
const DEFAULT_WINDOW_DAYS = { hour: 2, day: 30, week: 84, month: 365 };
// Finer granularity means more points per day, so its range is capped tighter.
const MAX_SPAN = { hour: 14 * DAY, day: 366 * DAY, week: 366 * DAY, month: 366 * DAY };

function resolveRange({ from, to }, interval) {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getTime() - DEFAULT_WINDOW_DAYS[interval] * DAY);
  const problem = (message) => new ValidationError([{ in: "query", field: "from", message }]);

  if (start > end) throw problem("'from' must not be after 'to'");
  if (end - start > MAX_SPAN[interval]) {
    throw problem(interval === "hour" ? "interval=hour is limited to a range of 14 days" : "Date range can be at most 366 days");
  }
  return { from: start, to: end };
}

const iso = (date) => date.toISOString();
const linkInfo = (link) => ({ id: String(link._id), shortCode: link.shortCode });

// Visits by real people in the range. Bots (link-preview robots, crawlers, uptime
// monitors) are excluded from every statistic and counted separately.
const humanVisits = (link, range) => ({
  url: link._id,
  clickedAt: { $gte: range.from, $lte: range.to },
  device: { $ne: "bot" },
});

// ---------------------------------------------------------------- summary

// "Top N values of one field": one small pipeline of three stages.
//   $match → keep only this link's human visits in the range (served by the
//            { url, clickedAt } index, so only those events are even read)
//   $group → one output row per distinct value, counting the events in it
//   $sort  → biggest first (ties broken by name, so the order is stable)
//   $limit → keep the top N
const topBy = (field, match) =>
  ClickEvent.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, clicks: { $sum: 1 } } },
    { $sort: { clicks: -1, _id: 1 } },
    { $limit: TOP_N },
  ]).then((rows) => rows.map((row) => ({ name: row._id, clicks: row.clicks })));

async function getSummary(actor, id, query) {
  const link = await getUrlFor(actor, id); // 404 unless the caller may manage this link
  const range = resolveRange(query, "day");
  const match = humanVisits(link, range);

  // Six independent questions, asked at the same time. (MongoDB's $facet could answer them in
  // one pass; separate queries are simpler to read and to change.)
  const [clicks, botClicks, devices, browsers, operatingSystems, referrers] = await Promise.all([
    ClickEvent.countDocuments(match),
    ClickEvent.countDocuments({ url: link._id, clickedAt: match.clickedAt, device: "bot" }),
    topBy("device", match),
    topBy("browser", match),
    topBy("os", match),
    topBy("referrer", match),
  ]);

  return {
    link: linkInfo(link),
    range: { from: iso(range.from), to: iso(range.to) },
    // `allTimeClicks` is the link's own counter. It is usually larger: it includes bots,
    // visitors who asked not to be tracked, and clicks from before analytics existed.
    totals: { clicks, botClicks, allTimeClicks: link.clicks },
    devices,
    browsers,
    operatingSystems,
    referrers,
  };
}

// ---------------------------------------------------------------- time series

// One expression turns each click's timestamp into the START of its bucket
// (the beginning of its hour / day / week / month, in the requested time zone).
// $dateTrunc needs MongoDB 5.0 or newer.
const bucketOf = (interval, timezone) => ({
  $dateTrunc: {
    date: "$clickedAt",
    unit: interval,
    timezone,
    ...(interval === "week" && { startOfWeek: "monday" }),
  },
});

function timeseriesPipeline(match, interval, timezone) {
  return [
    { $match: match },
    { $group: { _id: bucketOf(interval, timezone), clicks: { $sum: 1 } } }, // one row per bucket
    { $sort: { _id: 1 } }, // oldest first
  ];
}

async function getTimeseries(actor, id, query) {
  const link = await getUrlFor(actor, id);
  const range = resolveRange(query, query.interval);

  let rows;
  try {
    rows = await ClickEvent.aggregate(timeseriesPipeline(humanVisits(link, range), query.interval, query.timezone));
  } catch (err) {
    if (/\$dateTrunc/.test(err.message)) {
      throw new AppError(501, "ANALYTICS_UNSUPPORTED_SERVER", "Time series needs MongoDB 5.0 or newer.");
    }
    throw err;
  }

  return {
    link: linkInfo(link),
    interval: query.interval,
    timezone: query.timezone,
    range: { from: iso(range.from), to: iso(range.to) },
    // SPARSE: only buckets that had clicks appear. A bucket with zero clicks has no events,
    // so the database has nothing to produce it from. A chart fills the gaps with zero.
    points: rows.map((row) => ({ bucket: iso(row._id), clicks: row.clicks })),
  };
}

// ---------------------------------------------------------------- raw events

async function listEvents(actor, id, { page, limit, from, to }) {
  const link = await getUrlFor(actor, id);

  const filter = { url: link._id };
  if (from || to) filter.clickedAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [items, total] = await Promise.all([
    ClickEvent.find(filter).sort({ clickedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ClickEvent.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    link: linkInfo(link),
    items: items.map((e) => ({ id: String(e._id), clickedAt: iso(e.clickedAt), device: e.device, browser: e.browser, os: e.os, referrer: e.referrer })),
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  };
}

module.exports = { getSummary, getTimeseries, listEvents, timeseriesPipeline };
