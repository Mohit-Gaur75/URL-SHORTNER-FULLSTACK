const { randomUUID } = require("crypto");

// Gives every request a unique id, returned to the client in the
// X-Request-Id header and inside every error body. When a user reports
// "it failed", this id finds the exact request in the server logs.
// We always generate our own: trusting a client-supplied id would let anyone
// forge log entries.
module.exports = (req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
};
