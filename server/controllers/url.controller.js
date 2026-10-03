const env = require("../config/env");
const urlService = require("../services/url.service");

const toUrlResponse = (url) => ({
  id: url._id,
  originalUrl: url.originalUrl,
  shortCode: url.shortCode,
  shortUrl: `${env.baseUrl}/${url.shortCode}`,
  isCustomAlias: url.isCustomAlias,
  status: url.status,
  clicks: url.clicks,
  lastClickedAt: url.lastClickedAt,
  expiresAt: url.expiresAt,
  createdAt: url.createdAt,
  updatedAt: url.updatedAt,
});

exports.createUrl = async (req, res) => {
  const { originalUrl, customCode, expiresAt } = req.validated.body;
  const { url, created } = await urlService.createShortUrl({
    originalUrl,
    customCode,
    expiresAt,
    userId: req.user?._id ?? null,
  });
  
  res.status(created ? 201 : 200).json(toUrlResponse(url));
};

exports.redirectUrl = async (req, res) => {
  const destination = await urlService.resolveShortCode(req.params.code);
  res.redirect(destination);
};
