const env = require("../config/env");

const REFRESH_COOKIE = "refresh_token";

// httpOnly   → JavaScript on the page can never read it, so an XSS bug can't steal it
// secure     → only sent over HTTPS (production)
// sameSite   → the browser withholds it on requests started by OTHER sites (CSRF defense)
// path       → only sent to /api/auth/*, never to the redirect route or other API calls
const baseOptions = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: "/api/auth",
});

const setRefreshCookie = (res, token, expiresAt) =>
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions(), expires: expiresAt });

const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, baseOptions());

module.exports = { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie };
