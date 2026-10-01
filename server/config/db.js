const mongoose = require("mongoose");
const env = require("./env");

// Throws on failure. Deciding what to do about it (exit, retry) is the
// caller's job, and server.js is the one place that decides.
const connectDB = async () => {
  await mongoose.connect(env.mongoUri);
  console.log("✅ MongoDB connected");
};

module.exports = connectDB;
