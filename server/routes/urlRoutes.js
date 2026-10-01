const router = require("express").Router();
const { createUrl } = require("../controllers/urlControllers");
const validateUrl = require("../middleware/validateUrl");
const { createLimiter } = require("../middleware/rateLimit");

router.post("/", createLimiter, validateUrl, createUrl);

module.exports = router;