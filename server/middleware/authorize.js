const { AuthorizationError } = require("../utils/errors");

module.exports = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    throw new AuthorizationError();
  }
  next();
};
