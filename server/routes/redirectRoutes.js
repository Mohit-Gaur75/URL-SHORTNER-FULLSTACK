const router = require("express").Router();
const { redirectUrl } = require("../controllers/urlControllers");

router.get("/:code", redirectUrl);

module.exports = router;