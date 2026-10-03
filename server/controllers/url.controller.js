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
  // req.user exists only if the caller sent a valid token (optionalAuthenticate)
  const { url, created } = await urlService.createShortUrl({
    originalUrl,
    customCode,
    expiresAt,
    userId: req.user?._id ?? null,
  });
  res.status(created ? 201 : 200).json(toUrlResponse(url));
};

exports.redirectUrl = async (req, res) => {
  // A HEAD request asks "what would a GET do?". It must not count as a visit.
  const countClick = req.method !== "HEAD";
  const destination = await urlService.resolveShortCode(req.params.code, { countClick });

  res.redirect(302, destination);
};
