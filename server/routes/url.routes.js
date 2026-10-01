const router = require("express").Router();
const { createUrl } = require("../controllers/url.controller");
const { createUrlBody } = require("../validators/url.validator");
const validate = require("../middleware/validate");
const { createLimiter } = require("../middleware/rateLimit");

router.post("/", createLimiter, validate({ body: createUrlBody }), createUrl);

module.exports = router;
