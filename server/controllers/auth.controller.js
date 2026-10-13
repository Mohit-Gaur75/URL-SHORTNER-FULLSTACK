const authService = require("../services/auth.service");
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
  sendSession(res, 201, await authService.register({ name, email, password }));
};

exports.login = async (req, res) => {
  const { email, password } = req.validated.body;
  sendSession(res, 200, await authService.login({ email, password }));
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
  clearRefreshCookie(res);
  res.status(204).end();
};

exports.getMe = async (req, res) => {
  res.json({ user: authService.toPublicUser(req.user) }); // req.user set by authenticate
};
