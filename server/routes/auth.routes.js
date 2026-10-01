const router = require("express").Router();
const { register, login, getMe } = require("../controllers/auth.controller");
const { registerBody, loginBody } = require("../validators/auth.validator");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const { authLimiter } = require("../middleware/rateLimit");

router.post("/register", authLimiter, validate({ body: registerBody }), register);
router.post("/login", authLimiter, validate({ body: loginBody }), login);
router.get("/me", authenticate, getMe);

module.exports = router;
