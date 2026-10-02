const authService = require("../services/auth.service");
const { AuthenticationError } = require("../utils/errors");

module.exports = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AuthenticationError("Not authenticated");
  }

  req.user = await authService.authenticateToken(token);
  next();
};
