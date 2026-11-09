const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const requestId = require("./middleware/requestId");
const { sanitize } = require("./middleware/sanitize");
const preventHpp = require("./middleware/preventHpp");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { globalFlood } = require("./middleware/rateLimit");

const app = express();

// Trust reverse proxy (Docker, Nginx, Cloudflare) for accurate client IP rate limiting
app.set("trust proxy", env.trustProxy);

// 1. Request ID assignment (first, so all logs and errors carry the ID)
app.use(requestId);

// 2. Production Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: env.isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// 3. Strict Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: env.clientUrl,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
  })
);

// 4. Global Anti-Flooding Rate Limiter
app.use("/api", globalFlood);

// 5. Body Parsing with strict payload size limit (prevents memory exhaustion)
app.use(express.json({ limit: "10kb" }));

// 6. Defense-in-depth: NoSQL injection & prototype pollution sanitization
app.use(sanitize);

// 7. HTTP Parameter Pollution (HPP) defense
app.use(preventHpp);

// API Endpoints
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/urls", require("./routes/url.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/", require("./routes/redirect.routes")); // wildcard redirect route is last

// 404 & Centralized Error Handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;
