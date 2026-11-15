const adminService = require("../services/admin.service");
const { listAuditLogs } = require("../services/audit.service");

exports.getOverview = async (req, res) => {
  res.json(await adminService.getOverview());
};

exports.getAuditLogs = async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const result = await listAuditLogs(req.user, { limit, page });
  res.json(result);
};
