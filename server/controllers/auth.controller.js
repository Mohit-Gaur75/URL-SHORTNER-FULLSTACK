const authService = require("../services/auth.service");
const { logAudit, listAuditLogs } = require("../services/audit.service");
const { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } = require("../utils/cookies");
const { AuthenticationError } = require("../utils/errors");

// What a successful login/register/refresh sends back:
//   in the BODY   → the short-lived access token (the client keeps it in memory)
//   in a COOKIE   → the refresh token (httpOnly: JavaScript can never see it)
function sendSession(res, status, { user, session }) {
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  res.status(status).json({ accessToken: session.accessToken, user });
}

exports.register = async (req, res) => {
  const { name, email, password } = req.validated.body;
  const result = await authService.register({ name, email, password });
  logAudit({ user: result.user, action: "AUTH_REGISTER", details: { email }, req });
  sendSession(res, 201, result);
};

exports.login = async (req, res) => {
  const { email, password } = req.validated.body;
  const result = await authService.login({ email, password });
  logAudit({ user: result.user, action: "AUTH_LOGIN", details: { email }, req });
  sendSession(res, 200, result);
};

exports.refresh = async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) throw new AuthenticationError("Refresh token missing", "REFRESH_TOKEN_MISSING");

  try {
    sendSession(res, 200, await authService.refresh(rawToken));
  } catch (err) {
    // A refresh token we rejected is useless. Don't leave it in the browser.
    if (err instanceof AuthenticationError) clearRefreshCookie(res);
    throw err;
  }
};

exports.logout = async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) await authService.logout(rawToken);
  clearRefreshCookie(res);
  res.status(204).end();
};

exports.logoutEverywhere = async (req, res) => {
  await authService.logoutEverywhere(req.user._id);
  logAudit({ user: req.user, action: "AUTH_LOGOUT_ALL", req });
  clearRefreshCookie(res);
  res.status(204).end();
};

exports.getMe = async (req, res) => {
  res.json({ user: authService.toPublicUser(req.user) }); // req.user set by authenticate
};

exports.updateProfile = async (req, res) => {
  const { name } = req.validated.body;
  const user = await authService.updateProfile(req.user._id, { name });
  logAudit({ user: req.user, action: "PROFILE_UPDATE", details: { newName: name }, req });
  res.json({ user });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.validated.body;
  const { user, session } = await authService.changePassword(req.user._id, {
    currentPassword,
    newPassword,
  });
  logAudit({ user: req.user, action: "PASSWORD_CHANGE", req });
  sendSession(res, 200, { user, session });
};

exports.deleteAccount = async (req, res) => {
  const { password } = req.validated.body;
  await authService.deleteAccount(req.user._id, password);
  logAudit({ user: req.user, action: "ACCOUNT_DELETE", req });
  clearRefreshCookie(res);
  res.status(204).end();
};

exports.getAuditLogs = async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const result = await listAuditLogs(req.user, { limit, page });
  res.json(result);
};
