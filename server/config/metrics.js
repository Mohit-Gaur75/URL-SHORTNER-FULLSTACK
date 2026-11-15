const client = require("prom-client");

// Initialize standard Prometheus registry
const register = new client.Registry();

// Enable standard default system metrics (event loop lag, memory, CPU)
client.collectDefaultMetrics({ register, prefix: "shortener_" });

// Custom Application Metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: "shortener_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
register.registerMetric(httpRequestDurationMicroseconds);

const redirectsTotal = new client.Counter({
  name: "shortener_redirects_total",
  help: "Total count of short link redirects processed",
  labelNames: ["status", "country"],
});
register.registerMetric(redirectsTotal);

const activeLinksGauge = new client.Gauge({
  name: "shortener_active_links_total",
  help: "Total count of active short URLs in the system",
});
register.registerMetric(activeLinksGauge);

/**
 * Middleware tracking HTTP duration and status codes
 */
function metricsMiddleware(req, res, next) {
  // Avoid instrumenting the metrics endpoint itself
  if (req.path === "/metrics") return next();

  const start = process.hrtime();
  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.baseUrl || req.route?.path || req.path || "unknown";
    httpRequestDurationMicroseconds
      .labels(req.method, route, String(res.statusCode))
      .observe(durationSeconds);
  });
  next();
}

module.exports = {
  register,
  metricsMiddleware,
  redirectsTotal,
  activeLinksGauge,
};
