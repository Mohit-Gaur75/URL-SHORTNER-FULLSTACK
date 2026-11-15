const AuditLog = require("../models/auditLog.model");

/**
 * Records an audit log event asynchronously.
 * Fire-and-forget so non-critical audit writes never delay HTTP responses.
 */
function logAudit({ user = null, action, resourceType = null, resourceId = null, details = {}, req = null }) {
  try {
    const userId = user?._id || user?.id || user || null;
    const ip = req ? (req.ip || req.get("x-forwarded-for") || req.connection?.remoteAddress || null) : null;
    const userAgent = req ? (req.get("user-agent") || null) : null;

    AuditLog.create({
      user: userId,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      details,
      ip: typeof ip === "string" ? ip.slice(0, 45) : null,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 255) : null,
    }).catch((err) => {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[audit] failed to record audit event:", err.message);
      }
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[audit] error scheduling audit:", err.message);
    }
  }
}

/**
 * Lists audit logs for a user or admin.
 */
async function listAuditLogs(user, { limit = 20, page = 1 } = {}) {
  const filter = user.role === "ADMIN" ? {} : { user: user._id };
  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      id: String(item._id),
      action: item.action,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      details: item.details,
      ip: item.ip,
      userAgent: item.userAgent,
      createdAt: item.createdAt,
      user: item.user ? { id: String(item.user._id), name: item.user.name, email: item.user.email } : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { logAudit, listAuditLogs };
