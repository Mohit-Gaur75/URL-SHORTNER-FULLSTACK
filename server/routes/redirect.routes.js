const router = require("express").Router();
const { redirectUrl } = require("../controllers/url.controller");
const noStore = require("../middleware/noStore");

router.get("/:code", noStore, redirectUrl);

module.exports = router;
