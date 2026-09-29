const validUrl = require("valid-url");

module.exports = (req, res, next) => {
  const { originalUrl } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ message: "URL is required" });
  }

  if (!validUrl.isWebUri(originalUrl)) {
    return res.status(400).json({ message: "Invalid URL format" });
  }

  next();
};
