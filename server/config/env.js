const path = require("path");

// Load server/.env no matter which folder the process was started from.
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const REQUIRED = ["MONGO_URI", "JWT_SECRET", "BASE_URL"];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

if (process.env.JWT_SECRET.length < 32) {
  const msg = "JWT_SECRET is too short (use at least 32 random characters)";
  if (isProduction) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
  console.warn(`⚠️  ${msg}`);
}

module.exports = Object.freeze({
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  baseUrl: process.env.BASE_URL.replace(/\/+$/, ""), // no trailing slash
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
});
