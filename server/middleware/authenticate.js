const authService = require("../services/auth.service");
const apiKeyService = require("../services/apiKey.service");
const { AuthenticationError } = require("../utils/errors");

module.exports = async (req, res, next) => {
  const apiKeyHeader = req.headers["x-api-key"];
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  // Support both x-api-key header and Authorization: Bearer sk_live_...
  if (apiKeyHeader || (scheme === "Bearer" && token && token.startsWith("sk_live_"))) {
    const rawKey = apiKeyHeader || token;
    req.user = await apiKeyService.authenticateApiKey(rawKey);
    return next();
  }

  if (scheme !== "Bearer" || !token) {
    throw new AuthenticationError("Not authenticated");
  }

  req.user = await authService.authenticateToken(token);
  next();
};
