const router = require("express").Router();
const { createUrl, listUrls, getUrl, updateUrl, deleteUrl } = require("../controllers/url.controller");
const analytics = require("../controllers/analytics.controller");
const { analyticsQuery, eventsQuery } = require("../validators/analytics.validator");
const { createUrlBody, updateUrlBody, listUrlsQuery } = require("../validators/url.validator");
const { idParams } = require("../validators/common");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const noStore = require("../middleware/noStore");
const optionalAuthenticate = require("../middleware/optionalAuthenticate");
const { createLink, manageLinks, analytics: analyticsLimit } = require("../middleware/rateLimit");

router.use(noStore);

router.post("/", optionalAuthenticate, createLink, validate({ body: createUrlBody }), createUrl);

router.get("/", authenticate, manageLinks, validate({ query: listUrlsQuery }), listUrls);
router.get("/:id", authenticate, manageLinks, validate({ params: idParams }), getUrl);
router.patch("/:id", authenticate, manageLinks, validate({ params: idParams, body: updateUrlBody }), updateUrl);
router.delete("/:id", authenticate, manageLinks, validate({ params: idParams }), deleteUrl);

router.get("/:id/analytics", authenticate, analyticsLimit, validate({ params: idParams, query: eventsQuery }), analytics.listClicks);
router.get("/:id/analytics/summary", authenticate, analyticsLimit, validate({ params: idParams, query: analyticsQuery }), analytics.getSummary);
router.get("/:id/analytics/timeseries", authenticate, analyticsLimit, validate({ params: idParams, query: analyticsQuery }), analytics.getTimeseries);

module.exports = router;
