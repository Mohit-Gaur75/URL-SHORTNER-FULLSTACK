const analyticsService = require("../services/analytics.service");

exports.listClicks = async (req, res) => {
  res.json(await analyticsService.listEvents(req.user, req.validated.params.id, req.validated.query));
};

exports.getSummary = async (req, res) => {
  res.json(await analyticsService.getSummary(req.user, req.validated.params.id, req.validated.query));
};

exports.getTimeseries = async (req, res) => {
  res.json(await analyticsService.getTimeseries(req.user, req.validated.params.id, req.validated.query));
};
