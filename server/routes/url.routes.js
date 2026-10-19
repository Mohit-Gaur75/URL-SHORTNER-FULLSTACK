const router = require("express").Router();
const { createUrl, listUrls, getUrl, updateUrl, deleteUrl } = require("../controllers/url.controller");
const { createUrlBody, updateUrlBody, listUrlsQuery } = require("../validators/url.validator");
const { idParams } = require("../validators/common");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const noStore = require("../middleware/noStore");
const optionalAuthenticate = require("../middleware/optionalAuthenticate");
const { createLink, manageLinks } = require("../middleware/rateLimit");

router.use(noStore);

router.post("/", optionalAuthenticate, createLink, validate({ body: createUrlBody }), createUrl);

router.get("/", authenticate, manageLinks, validate({ query: listUrlsQuery }), listUrls);
router.get("/:id", authenticate, manageLinks, validate({ params: idParams }), getUrl);
router.patch("/:id", authenticate, manageLinks, validate({ params: idParams, body: updateUrlBody }), updateUrl);
router.delete("/:id", authenticate, manageLinks, validate({ params: idParams }), deleteUrl);

module.exports = router;
