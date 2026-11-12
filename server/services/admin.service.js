const User = require("../models/user.model");
const Url = require("../models/url.model");
const ClickEvent = require("../models/clickEvent.model");

// Comprehensive platform overview for administrators
async function getOverview() {
  const [usersCount, linksCount, clicksCount, topLinks, recentUsers] = await Promise.all([
    User.estimatedDocumentCount(),
    Url.estimatedDocumentCount(),
    ClickEvent.estimatedDocumentCount(),
    Url.find({ status: { $ne: "deleted" } })
      .sort({ clicks: -1 })
      .limit(5)
      .select("shortCode originalUrl clicks status createdAt")
      .lean(),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt")
      .lean(),
  ]);

  return {
    totals: {
      users: usersCount,
      links: linksCount,
      clicks: clicksCount,
    },
    topLinks: topLinks.map((l) => ({
      id: String(l._id),
      shortCode: l.shortCode,
      originalUrl: l.originalUrl,
      clicks: l.clicks,
      status: l.status,
      createdAt: l.createdAt,
    })),
    recentUsers: recentUsers.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    })),
  };
}

module.exports = { getOverview };
