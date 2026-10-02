const authenticate = require("./authenticate");

module.exports = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
};
