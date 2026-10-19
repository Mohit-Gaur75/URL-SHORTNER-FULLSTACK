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

// --- sessions -------------------------------------------------------------
if (process.env.JWT_EXPIRES_IN) {
  console.warn("⚠️  JWT_EXPIRES_IN is no longer used. Access tokens now use ACCESS_TOKEN_EXPIRES_IN (default 15m).");
}

const cookieSameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
if (!["lax", "strict", "none"].includes(cookieSameSite)) {
  console.error("❌ COOKIE_SAMESITE must be lax, strict or none");
  process.exit(1);
}
// Cookies are HTTPS-only in production. In development (plain http) they can't be.
const cookieSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProduction;
if (cookieSameSite === "none" && !cookieSecure) {
  console.error("❌ COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers reject it otherwise)");
  process.exit(1);
}

// --- rate limiting --------------------------------------------------------
// How many reverse proxies sit between the internet and this server (Render,
// nginx, a load balancer...). It decides where the client's IP address comes
// from. Too HIGH and any client can claim any IP by sending an X-Forwarded-For
// header, which defeats every per-IP limit. Too LOW and, behind a proxy, every
// visitor appears to have the proxy's IP and they all share one limit.
// Default 0 = trust nobody, which is only right when no proxy is in front.
const trustProxy = process.env.TRUST_PROXY === undefined ? 0 : Number(process.env.TRUST_PROXY);
if (!Number.isInteger(trustProxy) || trustProxy < 0) {
  console.error("❌ TRUST_PROXY must be a whole number of proxies (0, 1, 2...), not true/false");
  process.exit(1);
}
if (isProduction && trustProxy === 0) {
  console.warn("⚠️  TRUST_PROXY is 0. If this server runs behind a reverse proxy (Render, nginx...), set TRUST_PROXY=1 or every visitor will share one rate limit.");
}

// Scales every rate limit. For DEVELOPMENT only (e.g. 10 lets you register ten
// test accounts an hour instead of one). Refused in production.
const rateLimitMultiplier = process.env.RATE_LIMIT_MULTIPLIER === undefined ? 1 : Number(process.env.RATE_LIMIT_MULTIPLIER);
if (!(rateLimitMultiplier > 0)) {
  console.error("❌ RATE_LIMIT_MULTIPLIER must be a positive number");
  process.exit(1);
}
if (isProduction && rateLimitMultiplier !== 1) {
  console.error("❌ RATE_LIMIT_MULTIPLIER must not be set in production");
  process.exit(1);
}
if (rateLimitMultiplier !== 1) {
  console.warn(`⚠️  Rate limits are scaled by ${rateLimitMultiplier} (development setting)`);
}


module.exports = Object.freeze({
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  baseUrl: process.env.BASE_URL.replace(/\/+$/, ""), // no trailing slash
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m", // short: it can't be revoked
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  // A refresh token that was JUST rotated and is presented again within this many
  // seconds is treated as a harmless race (two tabs), not as theft.
  refreshReuseGraceSeconds:
    process.env.REFRESH_REUSE_GRACE_SECONDS !== undefined ? Number(process.env.REFRESH_REUSE_GRACE_SECONDS) : 10,
  cookieSameSite,
  cookieSecure,
  trustProxy,
  rateLimitMultiplier,
});
