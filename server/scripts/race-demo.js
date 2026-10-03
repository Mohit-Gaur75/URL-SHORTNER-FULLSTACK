// Shows, with real concurrent requests, WHY "check, then insert" is wrong and
// WHY a read-modify-write counter loses clicks.
//
//   npm run db:race-demo
//
// Runs in a separate throwaway database ("<your database>-race-lab") and
// deletes it afterwards. Your real data is never touched.

const mongoose = require("mongoose");
const env = require("../config/env");

const CLIENTS = 20; //   how many "people" try to claim the same alias at the same moment
const CLICKS = 200; //   how many clicks arrive at the same moment
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tally = (results) =>
  Object.entries(results.reduce((acc, r) => ((acc[r] = (acc[r] || 0) + 1), acc), {}))
    .map(([outcome, count]) => `${count} x ${outcome}`)
    .join(", ");
const header = (text) => console.log(`\n${"=".repeat(78)}\n${text}\n${"=".repeat(78)}`);

(async () => {
  await mongoose.connect(env.mongoUri);
  const labName = `${mongoose.connection.name}-race-lab`;
  const lab = mongoose.connection.getClient().db(labName);
  await lab.dropDatabase();

  try {
    header(`PART 1: ${CLIENTS} people claim the alias "my-link" at the same moment`);
    console.log("A tiny pause (2 ms) sits between the check and the insert. It stands in for");
    console.log("everything a real server does there: validation, hashing, network hops.\n");

    // ---- Strategy A: check, then insert, and NO unique index
    const a = lab.collection("a_check_then_insert_no_index");
    const strategyA = async () => {
      if (await a.findOne({ shortCode: "my-link" })) return "told 'taken'";
      await sleep(2);
      await a.insertOne({ shortCode: "my-link" });
      return "told 'created'";
    };
    const resultsA = await Promise.all(Array.from({ length: CLIENTS }, strategyA));
    console.log("A) check, then insert, no unique index");
    console.log(`   outcomes : ${tally(resultsA)}`);
    console.log(`   in the database: ${await a.countDocuments({ shortCode: "my-link" })} links with the alias "my-link"`);
    console.log("   -> Most requests passed the check before the first insert landed. DUPLICATES:");
    console.log("      which person does /my-link redirect to now? (Exact numbers vary per run.)");

    // ---- Strategy B: check, then insert, WITH a unique index
    const b = lab.collection("b_check_then_insert_with_index");
    await b.createIndex({ shortCode: 1 }, { unique: true });
    const strategyB = async () => {
      if (await b.findOne({ shortCode: "my-link" })) return "told 'taken'";
      await sleep(2);
      try {
        await b.insertOne({ shortCode: "my-link" });
        return "told 'created'";
      } catch (err) {
        return err.code === 11000 ? "CRASH: duplicate-key error after the check passed" : `error: ${err.message}`;
      }
    };
    const resultsB = await Promise.all(Array.from({ length: CLIENTS }, strategyB));
    console.log("\nB) check, then insert, WITH the unique index");
    console.log(`   outcomes : ${tally(resultsB)}`);
    console.log(`   in the database: ${await b.countDocuments({ shortCode: "my-link" })} link(s)`);
    console.log("   -> The database protected the data, but the code was wrong: the losers did not");
    console.log("      get a clean 'taken' answer, they hit an error nobody planned for (an HTTP 500).");

    // ---- Strategy C: insert, and react to the database's answer (what we do)
    const c = lab.collection("c_insert_then_react");
    await c.createIndex({ shortCode: 1 }, { unique: true });
    const strategyC = async () => {
      try {
        await c.insertOne({ shortCode: "my-link" });
        return "told 'created'";
      } catch (err) {
        if (err.code === 11000) return "told 'taken' (clean 409)";
        throw err;
      }
    };
    const resultsC = await Promise.all(Array.from({ length: CLIENTS }, strategyC));
    console.log("\nC) just insert, and react to the answer  <- what createShortUrl does");
    console.log(`   outcomes : ${tally(resultsC)}`);
    console.log(`   in the database: ${await c.countDocuments({ shortCode: "my-link" })} link(s)`);
    console.log("   -> Exactly one winner, every loser gets a clean answer. The database decides;");
    console.log("      the code never has to guess.");

    header(`PART 2: ${CLICKS} clicks on one link at the same moment (the redirect counter)`);
    const links = lab.collection("links");
    await links.insertOne({ shortCode: "popular", clicks: 0 });

    // ---- read, add one in JavaScript, write back
    const readModifyWrite = async () => {
      const link = await links.findOne({ shortCode: "popular" });
      await sleep(1);
      await links.updateOne({ shortCode: "popular" }, { $set: { clicks: link.clicks + 1 } });
    };
    await Promise.all(Array.from({ length: CLICKS }, readModifyWrite));
    const lost = (await links.findOne({ shortCode: "popular" })).clicks;
    console.log("A) read the count, add 1 in JavaScript, write it back");
    console.log(`   expected ${CLICKS}, got ${lost}  ->  ${CLICKS - lost} clicks LOST`);
    console.log("   -> Many requests read the same old number and overwrote each other.");

    await links.updateOne({ shortCode: "popular" }, { $set: { clicks: 0 } });
    await Promise.all(
      Array.from({ length: CLICKS }, () => links.updateOne({ shortCode: "popular" }, { $inc: { clicks: 1 } }))
    );
    const exact = (await links.findOne({ shortCode: "popular" })).clicks;
    console.log("\nB) $inc: the database adds 1 itself, as one atomic step  <- what the redirect does");
    console.log(`   expected ${CLICKS}, got ${exact}  ->  ${exact === CLICKS ? "nothing lost" : "CLICKS LOST"}`);
    if (exact !== CLICKS) {
      console.log("   MongoDB guarantees that a single-document update like $inc is atomic, so this");
      console.log("   result is NOT expected from a real MongoDB server. Some MongoDB-compatible");
      console.log("   servers do not provide that guarantee. Check what you are connected to.");
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
