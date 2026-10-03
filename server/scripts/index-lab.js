// An experiment that shows, with numbers, what indexes do and what they cost.
//
//   npm run db:index-lab
//   node scripts/index-lab.js --docs=200000 --users=2000
//
// It creates a SEPARATE database called "<your database>-index-lab", fills it
// with fake links, runs the queries your app uses, and deletes it afterwards.
// Your real data is never read or written.

const mongoose = require("mongoose");
const env = require("../config/env");
const { summarizeExplain } = require("./lib/explain");

const numberArg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};
const DOCS = numberArg("docs", 100000);
const USERS = numberArg("users", 1000);
const CLICK_UPDATES = numberArg("updates", 3000);
const INSERTS = numberArg("inserts", 20000);

const ms = (n) => (n === null || n === undefined ? "n/a" : `${n.toFixed(2)} ms`);

async function averageMs(fn, runs) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) await fn();
  return Number(process.hrtime.bigint() - start) / 1e6 / runs;
}

// Runs one query three ways and prints what MongoDB did.
async function measure(label, makeCursor, runs) {
  const plan = summarizeExplain(await makeCursor().explain("executionStats"));
  const avg = await averageMs(() => makeCursor().toArray(), runs);

  let how;
  if (!plan.recognized) {
    how = "(plan not shown by this server)";
  } else {
    const used = plan.usesIndex ? `index ${plan.indexName ?? ""}`.trim() : plan.scansWholeCollection ? "FULL COLLECTION SCAN" : "?";
    how = `${used} | ${plan.stages.join(" > ")}${plan.sortsInMemory ? "  (sorts in memory)" : ""}`;
  }
  console.log(`  ${label.padEnd(28)} ${ms(avg).padStart(10)} per query`);
  console.log(`      ${how}`);
  if (plan.recognized) {
    console.log(`      examined ${plan.docsExamined ?? "n/a"} documents, ${plan.keysExamined ?? "n/a"} index keys, returned ${plan.returned ?? "n/a"}`);
  }
}

const header = (text) => console.log(`\n${"=".repeat(78)}\n${text}\n${"=".repeat(78)}`);

(async () => {
  await mongoose.connect(env.mongoUri);
  const labName = `${mongoose.connection.name}-index-lab`;
  const lab = mongoose.connection.getClient().db(labName);
  await lab.dropDatabase();
  const urls = lab.collection("urls");

  try {
    header(`SETUP: ${DOCS.toLocaleString()} links, ${USERS.toLocaleString()} users, in database "${labName}"`);
    const userIds = Array.from({ length: USERS }, () => new mongoose.Types.ObjectId());
    const baseTime = Date.UTC(2025, 0, 1);
    for (let start = 0; start < DOCS; start += 10000) {
      const batch = [];
      for (let i = start; i < Math.min(start + 10000, DOCS); i++) {
        batch.push({
          user: i % 5 === 0 ? null : userIds[i % USERS], // ~20% anonymous links
          originalUrl: `https://example.com/page/${i}`,
          shortCode: `c${i.toString(36)}`,
          clicks: i % 50,
          status: "active",
          createdAt: new Date(baseTime + i * 60000),
          updatedAt: new Date(baseTime + i * 60000),
        });
      }
      await urls.insertMany(batch, { ordered: false });
    }
    console.log(`Inserted ${(await urls.countDocuments()).toLocaleString()} documents. The collection has NO indexes except _id.`);

    const someCode = `c${Math.floor(DOCS / 2).toString(36)}`;
    const someUser = userIds[7];

    // -------------------------------------------------------------- A
    header("QUERY A: the redirect lookup   find({ shortCode })   <- your hottest path");
    console.log("Without an index MongoDB must read EVERY document to find one link:");
    await measure("no index", () => urls.find({ shortCode: someCode }), 20);
    await urls.createIndex({ shortCode: 1 }, { unique: true });
    console.log("\nWith the unique index on shortCode:");
    await measure("unique index {shortCode}", () => urls.find({ shortCode: someCode }), 300);

    // -------------------------------------------------------------- B
    header("QUERY B: the dashboard list   find({ user }).sort({ createdAt: -1 }).limit(20)");
    const list = () => urls.find({ user: someUser }).sort({ createdAt: -1 }).limit(20);
    console.log("Without an index:");
    await measure("no index", list, 20);

    await urls.createIndex({ user: 1 });
    console.log("\nWith a single-field index {user}: finds this user's links fast, but the");
    console.log("results are not in createdAt order, so MongoDB must still sort them:");
    await measure("index {user}", list, 300);

    await urls.dropIndex("user_1");
    await urls.createIndex({ user: 1, createdAt: -1 });
    console.log("\nWith the COMPOUND index {user, createdAt:-1}: the index is already in the");
    console.log("right order, so MongoDB reads 20 entries and stops. No sort at all:");
    await measure("index {user, createdAt:-1}", list, 300);

    // -------------------------------------------------------------- C
    header("THE COST OF INDEXES (reads got faster; what did writes pay?)");

    console.log(`\n1) Counting ${CLICK_UPDATES.toLocaleString()} clicks:  updateOne({ shortCode }, { $inc: { clicks: 1 } })`);
    console.log("   (this is exactly what every redirect does)");
    const clickRun = async () => {
      const start = process.hrtime.bigint();
      for (let i = 0; i < CLICK_UPDATES; i++) {
        await urls.updateOne({ shortCode: `c${(i % 1000).toString(36)}` }, { $inc: { clicks: 1 } });
      }
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    const without = await clickRun();
    await urls.createIndex({ clicks: 1 });
    const withIdx = await clickRun();
    console.log(`   without an index on clicks : ${(without / CLICK_UPDATES).toFixed(3)} ms per click`);
    console.log(`   WITH an index on clicks    : ${(withIdx / CLICK_UPDATES).toFixed(3)} ms per click`);
    const ratio = withIdx / without;
    if (ratio > 1.05) {
      console.log(`   -> ${ratio.toFixed(2)}x the time: every click now ALSO has to update the clicks index.`);
    } else {
      console.log(`   -> ${ratio.toFixed(2)}x: no clear difference in this run. Small data, one client and a`);
      console.log("      fast disk hide the cost. It is real, and grows with collection size and with many");
      console.log("      people clicking at once. Try again with --docs=500000 --updates=10000.");
    }
    await urls.dropIndex("clicks_1");

    console.log(`\n2) Inserting ${INSERTS.toLocaleString()} new links with different numbers of indexes:`);
    const makeDocs = (offset) =>
      Array.from({ length: INSERTS }, (_, i) => ({
        user: userIds[i % USERS],
        originalUrl: `https://example.com/x/${offset + i}`,
        shortCode: `n${offset}-${i.toString(36)}`,
        clicks: 0,
        status: "active",
        createdAt: new Date(baseTime + i * 1000),
      }));
    const insertTime = async (name, indexes) => {
      const c = lab.collection(name);
      for (const [keys, options] of indexes) await c.createIndex(keys, options);
      const docs = makeDocs(Math.floor(Math.random() * 1e6));
      const start = process.hrtime.bigint();
      for (let i = 0; i < docs.length; i += 5000) await c.insertMany(docs.slice(i, i + 5000), { ordered: false });
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    const t0 = await insertTime("cost_none", []);
    const t2 = await insertTime("cost_two", [[{ shortCode: 1 }, { unique: true }], [{ user: 1, createdAt: -1 }, {}]]);
    const t5 = await insertTime("cost_five", [
      [{ shortCode: 1 }, { unique: true }],
      [{ user: 1, createdAt: -1 }, {}],
      [{ clicks: 1 }, {}],
      [{ status: 1 }, {}],
      [{ originalUrl: 1 }, {}],
    ]);
    console.log(`   no extra indexes  : ${t0.toFixed(0)} ms`);
    console.log(`   2 indexes (ours)  : ${t2.toFixed(0)} ms   (${(t2 / t0).toFixed(2)}x)`);
    console.log(`   5 indexes         : ${t5.toFixed(0)} ms   (${(t5 / t0).toFixed(2)}x)`);
    console.log("   (Each index is another structure to update on every insert. Timings are noisy:");
    console.log("    run it twice and compare the trend, not single numbers.)");

    const stats = await lab.command({ collStats: "urls" }).catch(() => null);
    if (stats?.totalIndexSize) {
      console.log(`\n3) Disk: the "urls" collection holds ${(stats.size / 1e6).toFixed(1)} MB of data and`);
      console.log(`   ${(stats.totalIndexSize / 1e6).toFixed(1)} MB of indexes. Indexes also compete for RAM.`);
    }
  } finally {
    await lab.dropDatabase();
    console.log(`\nLab database "${labName}" deleted. Your real data was not touched.`);
    await mongoose.disconnect();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
