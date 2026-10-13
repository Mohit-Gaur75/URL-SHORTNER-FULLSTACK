const router = require("express").Router();
const cookieParser = require("cookie-parser");
const controller = require("../controllers/auth.controller");
const { registerBody, loginBody } = require("../validators/auth.validator");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const noStore = require("../middleware/noStore");
const requireCsrfHeader = require("../middleware/requireCsrfHeader");
const { authLimiter, refreshLimiter } = require("../middleware/rateLimit");

// Cookies are only read on /api/auth, so the redirect route never pays for parsing them.
router.use(cookieParser());
// Responses here carry tokens: no browser or proxy may store them.
router.use(noStore);

router.post("/register", authLimiter, validate({ body: registerBody }), controller.register);
router.post("/login", authLimiter, validate({ body: loginBody }), controller.login);
router.post("/refresh", refreshLimiter, requireCsrfHeader, controller.refresh);
router.post("/logout", refreshLimiter, requireCsrfHeader, controller.logout);
router.post("/logout-all", authenticate, requireCsrfHeader, controller.logoutEverywhere);
router.get("/me", authenticate, controller.getMe);

module.exports = router;
