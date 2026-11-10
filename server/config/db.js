const mongoose = require("mongoose");
const env = require("./env");

/**
 * High-performance MongoDB driver connection pool options.
 * Pre-allocates warm sockets to eliminate TCP handshake latency during bursts.
 */
const MONGO_POOL_OPTIONS = {
  maxPoolSize: 100, // Maximum concurrent sockets in the pool
  minPoolSize: 10, // Maintain 10 warm connections ready for traffic spikes
  maxIdleTimeMS: 30_000, // Close idle connections after 30s to conserve database memory
  serverSelectionTimeoutMS: 5000, // Fail fast (5s) if replica set election is pending
  socketTimeoutMS: 45_000, // Timeout queries hanging for > 45s to avoid connection leakage
};

const connectDB = async () => {
  await mongoose.connect(env.mongoUri, MONGO_POOL_OPTIONS);
  console.log("✅ MongoDB connected (pool: min 10, max 100)");
};

module.exports = connectDB;
module.exports.MONGO_POOL_OPTIONS = MONGO_POOL_OPTIONS;
