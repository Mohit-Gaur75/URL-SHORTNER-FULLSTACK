const mongoose = require("mongoose");

const URL_STATUSES = ["active", "disabled", "deleted"];

const urlSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    originalUrl: { type: String, required: true, trim: true, maxlength: 2048 },

    shortCode: { type: String, required: true, unique: true, immutable: true },

    isCustomAlias: { type: Boolean, default: false, immutable: true },

    status: { type: String, enum: URL_STATUSES, default: "active" },

    clicks: { type: Number, default: 0, min: 0 },
    lastClickedAt: { type: Date, default: null },

    expiresAt: { type: Date, default: null },
  },
  {
        timestamps: true,
  }
);

module.exports = mongoose.model("Url", urlSchema);
module.exports.URL_STATUSES = URL_STATUSES;
