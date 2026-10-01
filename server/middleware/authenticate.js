const authService = require("../services/auth.service");
const HttpError = require("../utils/HttpError");

module.exports = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Not authenticated");
  }

  req.user = await authService.authenticateToken(token);
  next();
};
