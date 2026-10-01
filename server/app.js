const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1); // on Render, so rate limiting sees the real client IP
app.use(helmet());
app.use(
	cors({
		origin: process.env.CLIENT_URL || "http://localhost:5173",
		methods: ["GET", "POST", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/urls", require("./routes/urlRoutes"));
app.use("/", require("./routes/redirectRoutes")); // still LAST

app.use(errorHandler);

module.exports = app;