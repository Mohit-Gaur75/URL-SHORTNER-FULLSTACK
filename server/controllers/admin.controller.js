const adminService = require("../services/admin.service");

exports.getOverview = async (req, res) => {
  res.json(await adminService.getOverview());
};
