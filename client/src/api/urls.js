import http from "./http";

export const createUrl = async ({
  originalUrl,
  customCode,
  expiresAt,
  tags,
  maxClicks,
  expiredRedirectUrl,
  password,
  metaTitle,
  metaDescription,
  metaImage,
  targetingRules,
}) => {
  const { data } = await http.post("/urls", {
    originalUrl,
    customCode: customCode || undefined,
    expiresAt: expiresAt || undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    maxClicks: maxClicks != null && maxClicks !== "" ? Number(maxClicks) : undefined,
    expiredRedirectUrl: expiredRedirectUrl || undefined,
    password: password || undefined,
    metaTitle: metaTitle || undefined,
    metaDescription: metaDescription || undefined,
    metaImage: metaImage || undefined,
    targetingRules: targetingRules && targetingRules.length > 0 ? targetingRules : undefined,
  });
  return data;
};

export const bulkCreateUrls = async (urls) => {
  const { data } = await http.post("/urls/bulk", { urls });
  return data;
};

export const getUrl = async (id) => {
  const { data } = await http.get(`/urls/${id}`);
  return data;
};

export const listUrls = async (params, { signal } = {}) => {
  const { data } = await http.get("/urls", { params, signal });
  return data; // { items: [...], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
};

export const updateUrl = async (id, changes) => {
  const { data } = await http.patch(`/urls/${id}`, changes);
  return data;
};

export const restoreUrl = async (id) => {
  const { data } = await http.patch(`/urls/${id}/restore`);
  return data;
};

export const deleteUrl = async (id) => {
  await http.delete(`/urls/${id}`);
};

export const getUrlSummary = async (id, params = {}) => {
  const { data } = await http.get(`/urls/${id}/analytics/summary`, { params });
  return data;
};

export const getUrlTimeseries = async (id, params = { interval: "day" }) => {
  const { data } = await http.get(`/urls/${id}/analytics/timeseries`, { params });
  return data;
};

export const getUrlEvents = async (id, params = { page: 1, limit: 10 }) => {
  const { data } = await http.get(`/urls/${id}/analytics`, { params });
  return data;
};

export const getSystemHealth = async () => {
  const { data } = await http.get("/health");
  return data;
};

export const verifyLinkPassword = async (code, password) => {
  const { data } = await http.post(`/urls/verify-password/${encodeURIComponent(code)}`, { password });
  return data;
};

export const checkLinkHealth = async (id) => {
  const { data } = await http.post(`/urls/${id}/health`);
  return data;
};

