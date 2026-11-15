const mongoose = require("mongoose");

const URL_STATUSES = ["active", "disabled", "deleted"];

const targetingRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["device", "country"],
      required: true,
    },
    target: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
  },
  { _id: false }
);

const urlSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    originalUrl: { type: String, required: true, trim: true, maxlength: 2048 },

    shortCode: { type: String, required: true, unique: true, immutable: true },

    isCustomAlias: { type: Boolean, default: false, immutable: true },

    status: { type: String, enum: URL_STATUSES, default: "active" },

    isArchived: { type: Boolean, default: false },

    tags: {
      type: [String],
      default: [],
    },

    maxClicks: {
      type: Number,
      default: null,
      min: 1,
    },

    expiredRedirectUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2048,
    },

    isPasswordProtected: {
      type: Boolean,
      default: false,
    },

    passwordHash: {
      type: String,
      default: null,
    },

    metaTitle: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },

    metaDescription: {
      type: String,
      default: null,
      trim: true,
      maxlength: 300,
    },

    metaImage: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2048,
    },

    healthStatus: {
      type: String,
      enum: ["unknown", "healthy", "warning", "broken"],
      default: "unknown",
    },

    healthStatusCode: {
      type: Number,
      default: null,
    },

    healthLatencyMs: {
      type: Number,
      default: null,
    },

    lastHealthCheckedAt: {
      type: Date,
      default: null,
    },

    healthError: {
      type: String,
      default: null,
      maxlength: 300,
    },

    targetingRules: {
      type: [targetingRuleSchema],
      default: [],
    },

    clicks: { type: Number, default: 0, min: 0 },
    lastClickedAt: { type: Date, default: null },

    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

urlSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Url", urlSchema);
module.exports.URL_STATUSES = URL_STATUSES;
