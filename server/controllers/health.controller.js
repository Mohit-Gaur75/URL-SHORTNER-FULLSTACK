const healthService = require("../services/health.service");

/**
 * GET /api/health
 * Comprehensive health dashboard endpoint.
 * Returns 200 with the full diagnostic health payload (status: "ok" | "degraded" | "down"),
 * allowing monitoring systems, administrators, and frontend dashboards to inspect service status.
 */
async function getHealth(req, res) {
  const health = await healthService.getDetailedHealth();
  res.status(200).json(health);
}

/**
 * GET /api/health/live
 * Kubernetes / Container Liveness probe.
 * Verifies that the Node.js process is alive, unblocked, and handling HTTP requests.
 * MUST NOT check external dependencies (to prevent cascading restart storms).
 */
function getLiveness(req, res) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

/**
 * GET /api/health/ready
 * Kubernetes / Load Balancer Readiness probe.
 * Verifies that downstream dependencies (MongoDB, Redis) are healthy and ready to serve traffic.
 * Returns 200 when ready to receive traffic; 503 when not ready (e.g., during DB outage or startup).
 */
async function getReadiness(req, res) {
  const readiness = await healthService.getReadiness();
  const statusCode = readiness.isReady ? 200 : 503;

  res.status(statusCode).json({
    status: readiness.status,
    timestamp: new Date().toISOString(),
    checks: readiness.checks,
  });
}

module.exports = {
  getHealth,
  getLiveness,
  getReadiness,
};
