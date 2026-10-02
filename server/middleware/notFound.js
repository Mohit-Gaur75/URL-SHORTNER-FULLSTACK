const { NotFoundError } = require("../utils/errors");

// Mounted after every route. If we got here, nothing matched.
module.exports = (req, res, next) => {
  next(new NotFoundError("Route not found", "ROUTE_NOT_FOUND"));
};
