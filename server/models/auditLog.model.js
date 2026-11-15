const mongoose = require("mongoose");

const AUDIT_ACTIONS = [
  "AUTH_REGISTER",
  "AUTH_LOGIN",
  "AUTH_LOGOUT",
  "AUTH_LOGOUT_ALL",
  "PASSWORD_CHANGE",
  "PROFILE_UPDATE",
  "ACCOUNT_DELETE",
  "URL_CREATE",
  "URL_BULK_CREATE",
  "URL_UPDATE",
  "URL_DELETE",
  "URL_RESTORE",
  "URL_ARCHIVE",
];

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    resourceType: { type: String, default: null },
    resourceId: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

auditLogSchema.index({ user: 1, createdAt: -1 });
// Retention policy: automatically expire audit logs after 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
