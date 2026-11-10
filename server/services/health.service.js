const mongoose = require("mongoose");
const env = require("../config/env");
const { getRedis } = require("../config/redis");

const PING_TIMEOUT_MS = 2000;

/**
 * Race a promise against a strict timeout.
 */
function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Actively ping MongoDB to verify connectivity and measure latency.
 */
async function checkDatabase() {
  const readyState = mongoose.connection.readyState;

  // 0 = disconnected, 2 = connecting, 3 = disconnecting
  if (readyState !== 1 || !mongoose.connection.db) {
    return {
      status: readyState === 2 ? "connecting" : "disconnected",
      latencyMs: null,
    };
  }

  const start = process.hrtime.bigint();
  try {
    await withTimeout(
      mongoose.connection.db.admin().ping(),
      PING_TIMEOUT_MS,
      "MongoDB ping timed out after 2000ms"
    );
    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1e6;

    return {
      status: "connected",
      latencyMs: Math.round(latencyMs * 100) / 100,
    };
  } catch (err) {
    return {
      status: "error",
      latencyMs: null,
      error: err.message,
    };
  }
}

/**
 * Actively ping Redis to verify connectivity and measure latency.
 */
async function checkRedis() {
  const redis = getRedis();

  if (!redis && !env.redisUrl) {
    return {
      status: "disabled",
      latencyMs: null,
    };
  }

  if (!redis || redis.status !== "ready") {
    return {
      status: "disconnected",
      latencyMs: null,
    };
  }

  const start = process.hrtime.bigint();
  try {
    await withTimeout(
      redis.ping(),
      PING_TIMEOUT_MS,
      "Redis ping timed out after 2000ms"
    );
    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1e6;

    return {
      status: "connected",
      latencyMs: Math.round(latencyMs * 100) / 100,
    };
  } catch (err) {
    return {
      status: "error",
      latencyMs: null,
      error: err.message,
    };
  }
}

/**
 * Gather runtime process memory and uptime metrics.
 */
function getSystemMetrics() {
  const mem = process.memoryUsage();
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    },
  };
}

/**
 * Run full readiness checks across downstream dependencies.
 */
async function getReadiness() {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  // MongoDB is our source of truth. If DB is down, we cannot serve requests.
  const isReady = db.status === "connected";

  return {
    isReady,
    status: isReady ? "ready" : "not_ready",
    checks: {
      database: db,
      redis,
    },
  };
}

/**
 * Full detailed health report.
 */
async function getDetailedHealth() {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const metrics = getSystemMetrics();

  // Status computation:
  // - "ok": MongoDB and Redis (if enabled) are both connected.
  // - "degraded": MongoDB is connected, but Redis is down/erroring (app functions via DB fallback).
  // - "down": MongoDB is down or unreachable (core service cannot function).
  let status = "ok";
  if (db.status !== "connected") {
    status = "down";
  } else if (redis.status === "disconnected" || redis.status === "error") {
    status = "degraded";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    service: "url-shortener",
    environment: env.nodeEnv,
    uptimeSeconds: metrics.uptimeSeconds,
    memory: metrics.memory,
    checks: {
      database: db,
      redis,
    },
  };
}

module.exports = {
  checkDatabase,
  checkRedis,
  getSystemMetrics,
  getReadiness,
  getDetailedHealth,
};
