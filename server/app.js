const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const requestId = require("./middleware/requestId");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { globalFlood } = require("./middleware/rateLimit");

const app = express();

app.set("trust proxy", env.trustProxy); // on Render, so rate limiting sees the real client IP
app.use(requestId); // first, so even errors from the middleware below have an id
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true, 
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Request-Id","Retry-After"], // lets browser code read it
  })
);
app.use("/api", globalFlood);
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/urls", require("./routes/url.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/", require("./routes/redirect.routes")); // still LAST of the routes

app.use(notFound); // nothing matched → 404 in the standard format
app.use(errorHandler); // must be the very last middleware

module.exports = app;
