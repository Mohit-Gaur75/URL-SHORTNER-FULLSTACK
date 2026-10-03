// Creates any indexes declared in the models that don't exist yet, then lists
// what exists. It NEVER drops anything.
//
//   npm run db:indexes
//
// While the server runs with Mongoose's default `autoIndex`, it does this by
// itself at startup. This script is the explicit, visible version of that, and
// what you will run in production, where building indexes automatically at
// every startup is not what you want.

const mongoose = require("mongoose");
const env = require("../config/env");
const Url = require("../models/url.model");
const User = require("../models/user.model");

(async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`Database: ${mongoose.connection.name}\n`);

  for (const Model of [Url, User]) {
    await Model.createIndexes();
    const indexes = await Model.collection.indexes();
    console.log(`${Model.collection.collectionName}:`);
    for (const index of indexes) {
      const keys = Object.entries(index.key).map(([field, dir]) => `${field}:${dir}`).join(", ");
      console.log(`  ${index.name.padEnd(24)} { ${keys} }${index.unique ? "  UNIQUE" : ""}`);
    }
    console.log("");
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
