const mongoose = require("mongoose");
const env = require("../config/env");

const DEVICES = ["desktop", "mobile", "tablet", "bot", "unknown"];

// ONE ROW PER VISIT. This is "event data": facts that happened at a moment in time,
// written once and never edited.
//
// Why a separate collection and not an array inside the link? A popular link would
// grow its own document with every click until it hit MongoDB's 16 MB limit, and every
// click would rewrite a huge document (Phase 4).
//
// WHAT IS DELIBERATELY NOT HERE: no IP address, no cookie or visitor id, no raw
// User-Agent, no full referrer URL. Nothing in this collection can point at a person.
const clickEventSchema = new mongoose.Schema(
  {
    url: { type: mongoose.Schema.Types.ObjectId, ref: "Url", required: true },
    clickedAt: { type: Date, required: true, default: Date.now },
    device: { type: String, enum: DEVICES, default: "unknown" },
    browser: { type: String, maxlength: 40, default: "Unknown" },
    os: { type: String, maxlength: 40, default: "Unknown" },
    referrer: { type: String, maxlength: 100, default: "direct" }, // the site's hostname only, or "direct"
  },
  { versionKey: false }
);

// Every analytics query is "this link's events, within a time range".
// Equality on `url` first, then the range on `clickedAt` (Phase 5: equality, then range/sort).
clickEventSchema.index({ url: 1, clickedAt: -1 });

// DATA MINIMIZATION: MongoDB deletes events older than the retention period by itself.
// Keeping data "just in case" is a liability; keep it only as long as it is useful.
clickEventSchema.index({ clickedAt: 1 }, { expireAfterSeconds: env.analyticsRetentionDays * 24 * 60 * 60 });

module.exports = mongoose.model("ClickEvent", clickEventSchema);
module.exports.DEVICES = DEVICES;
