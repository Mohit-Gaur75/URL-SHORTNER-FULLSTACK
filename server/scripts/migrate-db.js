// One-time migration for Phase 4. Brings EXISTING documents up to the new schema.
//
//   node scripts/migrate-phase4.js --dry-run     (only reports what it would do)
//   node scripts/migrate-phase4.js               (does it)
//
// Safe to run more than once: it only touches documents that are missing a
// field, so a second run changes nothing.
//
// Take a backup first:  mongodump --db url-shortener --out ./backup
//
// Why is this needed at all? Mongoose fills in defaults when it READS an old
// document, so the app works even before migrating. But the defaults don't
// exist in the database itself, which means queries like { status: "active" }
// or { role: "USER" } would silently skip old documents.

const mongoose = require("mongoose");
const env = require("../config/env");

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

const DEFAULTS = {
  urls: {
    status: "active",
    user: null, //          old links have no owner
    isCustomAlias: false, // we can't know how old codes were made, so false
    expiresAt: null,
    lastClickedAt: null,
  },
  users: { role: "USER" },
};

async function addMissingFields(collection, defaults) {
  for (const [field, value] of Object.entries(defaults)) {
    const filter = { [field]: { $exists: false } };
    const missing = await collection.countDocuments(filter);
    if (missing > 0 && !DRY_RUN) {
      await collection.updateMany(filter, { $set: { [field]: value } });
    }
    console.log(`  ${collection.collectionName}.${field}: ${missing} document(s) ${DRY_RUN ? "would be updated" : "updated"}`);
  }
}

// updatedAt starts out equal to createdAt: "last changed when it was created".
// Done in batches, so it also works on a large collection.
async function backfillUpdatedAt(collection) {
  const filter = { updatedAt: { $exists: false } };
  const missing = await collection.countDocuments(filter);

  if (!DRY_RUN) {
    while (true) {
      const batch = await collection
        .find(filter, { projection: { createdAt: 1 } })
        .limit(BATCH_SIZE)
        .toArray();
      if (batch.length === 0) break;

      await collection.bulkWrite(
        batch.map((doc) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { updatedAt: doc.createdAt ?? new Date() } },
          },
        }))
      );
    }
  }
  console.log(`  ${collection.collectionName}.updatedAt: ${missing} document(s) ${DRY_RUN ? "would be updated" : "updated"}`);
}

(async () => {
  await mongoose.connect(env.mongoUri);
  const db = mongoose.connection.db;
  console.log(`${DRY_RUN ? "DRY RUN: nothing will be written\n" : ""}Connected to database "${db.databaseName}"\n`);

  for (const name of ["urls", "users"]) {
    const collection = db.collection(name);
    console.log(`${name} (${await collection.countDocuments()} documents)`);
    await addMissingFields(collection, DEFAULTS[name]);
    await backfillUpdatedAt(collection);
    console.log("");
  }

  console.log(DRY_RUN ? "Dry run finished. Run again without --dry-run to apply." : "Migration finished.");
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
