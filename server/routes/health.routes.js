const { Router } = require("express");
const healthController = require("../controllers/health.controller");

const router = Router();

// Overall health report (includes service metrics, db, redis)
router.get("/", healthController.getHealth);

// Liveness probe (Kubernetes: livenessProbe)
router.get("/live", healthController.getLiveness);

// Readiness probe (Kubernetes: readinessProbe / Docker healthcheck)
router.get("/ready", healthController.getReadiness);

module.exports = router;
