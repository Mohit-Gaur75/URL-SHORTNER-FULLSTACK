const env = require("../config/env");
const urlService = require("../services/url.service");
const { logAudit } = require("../services/audit.service");

const toUrlResponse = (url) => {
  const isTimeExpired = Boolean(url.expiresAt && new Date(url.expiresAt) <= new Date());
  const isClickLimitReached = Boolean(url.maxClicks != null && url.clicks >= url.maxClicks);
  return {
    id: url._id,
    originalUrl: url.originalUrl,
    shortCode: url.shortCode,
    shortUrl: `${env.baseUrl}/${url.shortCode}`,
    isCustomAlias: url.isCustomAlias,
    status: url.status,
    isArchived: Boolean(url.isArchived),
    isPasswordProtected: Boolean(url.isPasswordProtected),
    tags: url.tags || [],
    maxClicks: url.maxClicks ?? null,
    expiredRedirectUrl: url.expiredRedirectUrl ?? null,
    clicks: url.clicks,
    lastClickedAt: url.lastClickedAt,
    expiresAt: url.expiresAt,
    createdAt: url.createdAt,
    updatedAt: url.updatedAt,
    isExpired: isTimeExpired || isClickLimitReached,
  };
};

exports.toUrlResponse = toUrlResponse;

exports.createUrl = async (req, res) => {
  const { originalUrl, customCode, expiresAt, tags, maxClicks, expiredRedirectUrl, password } = req.validated.body;

  const existingDuplicate = req.user
    ? await urlService.findExistingByOriginalUrl({ originalUrl, userId: req.user._id })
    : null;

  const { url, created } = await urlService.createShortUrl({
    originalUrl,
    customCode,
    expiresAt,
    tags,
    maxClicks,
    expiredRedirectUrl,
    password,
    userId: req.user?._id ?? null,
  });

  if (req.user) {
    logAudit({
      user: req.user,
      action: "URL_CREATE",
      resourceType: "url",
      resourceId: url._id,
      details: { shortCode: url.shortCode, originalUrl: url.originalUrl },
      req,
    });
  }

  if (created) res.location(`/api/urls/${url._id}`);
  res.status(created ? 201 : 200).json({
    ...toUrlResponse(url),
    ...(existingDuplicate && String(existingDuplicate._id) !== String(url._id)
      ? {
          duplicateWarning: {
            message: "You previously shortened this destination URL",
            shortCode: existingDuplicate.shortCode,
            createdAt: existingDuplicate.createdAt,
          },
        }
      : {}),
  });
};

exports.bulkCreateUrls = async (req, res) => {
  const { urls } = req.validated.body;
  const results = await urlService.bulkCreateShortUrls({
    items: urls,
    userId: req.user?._id ?? null,
  });

  if (req.user) {
    logAudit({
      user: req.user,
      action: "URL_BULK_CREATE",
      resourceType: "url",
      details: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
      },
      req,
    });
  }

  res.status(201).json({
    items: results.map((r) =>
      r.success
        ? { success: true, ...toUrlResponse(r.url), created: r.created }
        : { success: false, originalUrl: r.originalUrl, error: r.error }
    ),
    total: results.length,
    successful: results.filter((r) => r.success).length,
  });
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
  if (req.user) {
    logAudit({
      user: req.user,
      action: "URL_UPDATE",
      resourceType: "url",
      resourceId: url._id,
      details: req.validated.body,
      req,
    });
  }
  res.json(toUrlResponse(url));
};

exports.deleteUrl = async (req, res) => {
  await urlService.deleteUrlFor(req.user, req.validated.params.id);
  if (req.user) {
    logAudit({
      user: req.user,
      action: "URL_DELETE",
      resourceType: "url",
      resourceId: req.validated.params.id,
      req,
    });
  }
  res.status(204).end();
};

exports.restoreUrl = async (req, res) => {
  const url = await urlService.restoreUrlFor(req.user, req.validated.params.id);
  if (req.user) {
    logAudit({
      user: req.user,
      action: "URL_RESTORE",
      resourceType: "url",
      resourceId: url._id,
      req,
    });
  }
  res.json(toUrlResponse(url));
};

exports.redirectUrl = async (req, res) => {
  // A HEAD request asks "what would a GET do?". It must not count as a visit.
  const countClick = req.method !== "HEAD";
  const countryHeader =
    req.get("cf-ipcountry") ||
    req.get("x-country-code") ||
    req.get("x-country") ||
    "Unknown";
  const ip = req.ip || req.get("x-forwarded-for") || req.connection?.remoteAddress || "";
  const password = req.query.pwd || req.get("x-link-password") || null;

  const context = {
    userAgent: req.get("user-agent") || "",
    referrer: req.get("referrer") || req.get("referer") || "",
    country: countryHeader,
    ip,
    password,
    doNotTrack: req.get("dnt") === "1" || req.get("sec-gpc") === "1",
  };
  const destination = await urlService.resolveShortCode(req.params.code, { countClick, context });

  // 302 Found: a TEMPORARY redirect. Browsers don't remember it, so every visit
  // comes back through us (to be counted, and to notice expiry or edits).
  res.redirect(302, destination);
};

exports.verifyPassword = async (req, res) => {
  const { password } = req.validated.body;
  const countryHeader =
    req.get("cf-ipcountry") ||
    req.get("x-country-code") ||
    req.get("x-country") ||
    "Unknown";
  const ip = req.ip || req.get("x-forwarded-for") || req.connection?.remoteAddress || "";

  const context = {
    userAgent: req.get("user-agent") || "",
    referrer: req.get("referrer") || req.get("referer") || "",
    country: countryHeader,
    ip,
    doNotTrack: req.get("dnt") === "1" || req.get("sec-gpc") === "1",
  };

  const result = await urlService.verifyLinkPassword(req.params.code, password, { context });
  res.json(result);
};
