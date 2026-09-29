const express = require("express");
const router = express.Router();
const {
  shortenUrl,
  redirectUrl,
} = require("../controllers/urlControllers");

router.post("/api/shorten", shortenUrl);
router.get("/:code", redirectUrl);

module.exports = router;
