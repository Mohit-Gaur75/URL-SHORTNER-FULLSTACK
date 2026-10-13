const { AuthorizationError } = require("../utils/errors");

module.exports = (req, res, next) => {
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    throw new AuthorizationError("Missing required header", "CSRF_HEADER_REQUIRED");
  }
  next();
};
