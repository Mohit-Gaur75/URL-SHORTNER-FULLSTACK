// Script to promote, demote, or list user roles (ADMIN / USER)
//
// Usage:
//   node scripts/set-admin.js --list
//   node scripts/set-admin.js user@example.com ADMIN
//   node scripts/set-admin.js user@example.com USER

const mongoose = require("mongoose");
const env = require("../config/env");
const User = require("../models/user.model");

const [targetEmail, targetRole = "ADMIN"] = process.argv.slice(2);

(async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to database: ${mongoose.connection.name}\n`);

  if (!targetEmail || targetEmail === "--list") {
    const users = await User.find({}, "name email role createdAt").sort({ createdAt: -1 });
    console.log("=== Registered Platform Users ===");
    if (users.length === 0) {
      console.log("No users found.");
    } else {
      for (const u of users) {
        console.log(`- ${u.name.padEnd(20)} ${u.email.padEnd(30)} [${u.role || "USER"}] (Created: ${new Date(u.createdAt).toISOString().slice(0, 10)})`);
      }
    }
    console.log(`\nTotal users: ${users.length}`);
    await mongoose.disconnect();
    return;
  }

  const role = targetRole.toUpperCase();
  if (!["USER", "ADMIN"].includes(role)) {
    console.error(`Error: Invalid role "${targetRole}". Must be USER or ADMIN.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const user = await User.findOne({ email: targetEmail.toLowerCase().trim() });
  if (!user) {
    console.error(`Error: User with email "${targetEmail}" was not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const previousRole = user.role || "USER";
  user.role = role;
  await user.save();

  console.log(`✅ Success! Updated user ${user.email} (${user.name}):`);
  console.log(`   Previous Role: ${previousRole}`);
  console.log(`   New Role:      ${user.role}`);

  await mongoose.disconnect();
})().catch((err) => {
  console.error("Operation failed:", err.message);
  process.exit(1);
});
