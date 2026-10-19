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
  // handy for a dashboard: an expired link keeps its status but stops working
  isExpired: Boolean(url.expiresAt && new Date(url.expiresAt) <= new Date()),
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
  // 201 = we created it. 200 = this exact request was already done earlier
  // (a safe retry), and here is the existing link.
  if (created) res.location(`/api/urls/${url._id}`); // where the new link can be found
  res.status(created ? 201 : 200).json(toUrlResponse(url));
};

exports.listUrls = async (req, res) => {
  const { items, page, limit, total, totalPages } = await urlService.listUrlsFor(req.user, req.validated.query);
  res.json({
    items: items.map(toUrlResponse),
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  });
};

exports.getUrl = async (req, res) => {
  const url = await urlService.getUrlFor(req.user, req.validated.params.id);
  res.json(toUrlResponse(url));
};

exports.updateUrl = async (req, res) => {
  const url = await urlService.updateUrlFor(req.user, req.validated.params.id, req.validated.body);
  res.json(toUrlResponse(url));
};

exports.deleteUrl = async (req, res) => {
  await urlService.deleteUrlFor(req.user, req.validated.params.id);
  res.status(204).end();
};

exports.redirectUrl = async (req, res) => {
  // A HEAD request asks "what would a GET do?". It must not count as a visit.
  const countClick = req.method !== "HEAD";
  const destination = await urlService.resolveShortCode(req.params.code, { countClick });

  // 302 Found: a TEMPORARY redirect. Browsers don't remember it, so every visit
  // comes back through us (to be counted, and to notice expiry or edits).
  res.redirect(302, destination);
};
