const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const noStore = require("../middleware/noStore");
const { getOverview } = require("../controllers/admin.controller");

// Every route in this file is admin-only. Putting the guard on the ROUTER means a
// route added here later is protected by default and can't be forgotten.
router.use(authenticate, authorize("ADMIN"), noStore);

router.get("/overview", getOverview);

module.exports = router;
