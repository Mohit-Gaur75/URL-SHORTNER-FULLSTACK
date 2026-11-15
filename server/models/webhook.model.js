const mongoose = require("mongoose");

const WEBHOOK_EVENTS = ["link.clicked", "link.quota_reached", "link.expired"];

const webhookSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    secret: {
      type: String,
      required: true,
    },
    events: {
      type: [String],
      enum: WEBHOOK_EVENTS,
      default: ["link.clicked", "link.quota_reached", "link.expired"],
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true,
    },
    failureCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastDeliveredAt: {
      type: Date,
      default: null,
    },
    lastStatusCode: {
      type: Number,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Webhook", webhookSchema);
module.exports.WEBHOOK_EVENTS = WEBHOOK_EVENTS;
