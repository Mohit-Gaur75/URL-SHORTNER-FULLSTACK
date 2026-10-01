const router = require("express").Router();
const { register, login, getMe } = require("../controllers/authControllers");
const protect = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", protect, getMe);

module.exports = router;