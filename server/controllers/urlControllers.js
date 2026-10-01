const Url = require("../models/url");
const HttpError = require("../utils/HttpError");
const { generate, isValidCode } = require("../utils/shortCode");

const toResponse = (url) => ({
  id: url._id,
  originalUrl: url.originalUrl,
  shortCode: url.shortCode,
  shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
  clicks: url.clicks,
  createdAt: url.createdAt,
});

exports.createUrl = async (req, res) => {
  const { originalUrl, customCode } = req.body;
  const isCustom = Boolean(customCode);
  const attempts = isCustom ? 1 : 5;

  for (let i = 0; i < attempts; i++) {
    try {
      const url = await Url.create({
        originalUrl,
        shortCode: isCustom ? customCode : generate(),
      });
      return res.status(201).json(toResponse(url));
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000 = duplicate key (unique index)
      if (isCustom) throw new HttpError(409, "That short code is already taken");
      // random code collided: loop and try a new one
    }
  }
  throw new HttpError(500, "Could not generate a unique code, please retry");
};

exports.redirectUrl = async (req, res) => {
  const { code } = req.params;

  // Junk like "favicon.ico" never touches the database
  if (!isValidCode(code)) throw new HttpError(404, "URL not found");

  // Find and increment in ONE atomic operation
  const url = await Url.findOneAndUpdate(
    { shortCode: code },
    { $inc: { clicks: 1 } }
  );

  if (!url) throw new HttpError(404, "URL not found");
  res.redirect(url.originalUrl);
};