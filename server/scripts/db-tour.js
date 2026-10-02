// A READ-ONLY guided tour of your database. It changes nothing.
//
//   npm run db:tour
//
// Shows: what a collection and a document look like, which indexes exist,
// and your first aggregation pipelines.

const mongoose = require("mongoose");
const env = require("../config/env");

const title = (text) => console.log(`\n=== ${text} ${"=".repeat(Math.max(0, 70 - text.length))}`);
const show = (value) => console.log(JSON.stringify(value, null, 2));

(async () => {
  await mongoose.connect(env.mongoUri);
  const db = mongoose.connection.db;
  const urls = db.collection("urls");
  const users = db.collection("users");

  title("1. COLLECTIONS: a collection is a table-like group of documents");
  console.log(`urls : ${await urls.countDocuments()} documents`);
  console.log(`users: ${await users.countDocuments()} documents`);

  title("2. A DOCUMENT: one record, stored as JSON-like BSON");
  show(await urls.findOne({}, { sort: { createdAt: -1 } }));
  console.log("\n(user) the password hash is hidden here on purpose:");
  show(await users.findOne({}, { projection: { password: 0 } }));

  title("3. INDEXES: what MongoDB can look things up by quickly");
  console.log("urls:");
  show((await urls.indexes()).map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })));
  console.log("users:");
  show((await users.indexes()).map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })));

  title("4. AGGREGATION: a pipeline of stages; each stage feeds the next");

  console.log("How many links per status?");
  console.log("  [ { $group: { _id: '$status', links: { $sum: 1 } } } ]");
  show(await urls.aggregate([{ $group: { _id: "$status", links: { $sum: 1 } } }]).toArray());

  console.log("\nTotal clicks per status:");
  console.log("  [ { $group: { _id: '$status', clicks: { $sum: '$clicks' } } } ]");
  show(await urls.aggregate([{ $group: { _id: "$status", clicks: { $sum: "$clicks" } } }]).toArray());

  console.log("\nTop 5 links by clicks:");
  console.log("  [ { $sort: { clicks: -1 } }, { $limit: 5 }, { $project: { ... } } ]");
  show(
    await urls
      .aggregate([
        { $sort: { clicks: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, shortCode: 1, clicks: 1, status: 1 } },
      ])
      .toArray()
  );

  console.log("\nLinks per owner (the user's _id; null means anonymous):");
  console.log("  [ { $group: { _id: '$user', links: { $sum: 1 } } } ]");
  show(await urls.aggregate([{ $group: { _id: "$user", links: { $sum: 1 } } }]).toArray());

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
