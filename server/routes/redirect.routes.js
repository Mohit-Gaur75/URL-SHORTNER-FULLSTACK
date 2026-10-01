const router = require("express").Router();
const { redirectUrl } = require("../controllers/url.controller");

router.get("/:code", redirectUrl);

module.exports = router;
