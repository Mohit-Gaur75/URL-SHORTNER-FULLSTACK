const env = require("../config/env");
const urlService = require("../services/url.service");

const toUrlResponse = (url) => ({
  id: url._id,
  originalUrl: url.originalUrl,
  shortCode: url.shortCode,
  shortUrl: `${env.baseUrl}/${url.shortCode}`,
  clicks: url.clicks,
  createdAt: url.createdAt,
});

exports.createUrl = async (req, res) => {
  const { originalUrl, customCode } = req.validated.body;
  const url = await urlService.createShortUrl({ originalUrl, customCode });
  res.status(201).json(toUrlResponse(url));
};

exports.redirectUrl = async (req, res) => {
  const destination = await urlService.resolveShortCode(req.params.code);
  res.redirect(destination);
};
