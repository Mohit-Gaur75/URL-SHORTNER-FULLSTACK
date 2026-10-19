const router = require("express").Router();
const { redirectUrl } = require("../controllers/url.controller");
const noStore = require("../middleware/noStore");
const { redirectMisses } = require("../middleware/rateLimit");

router.get("/:code", redirectMisses, noStore, redirectUrl);

module.exports = router;
