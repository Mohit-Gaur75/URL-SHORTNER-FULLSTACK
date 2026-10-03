// Measures how fast GET /:code answers, and checks that no click is lost.
//
//   node scripts/redirect-bench.js --code=abc1234
//   node scripts/redirect-bench.js --code=abc1234 --requests=5000 --concurrency=50
//   node scripts/redirect-bench.js --code=abc1234 --method=HEAD     (read-only: counts nothing)
//
// The server must be running. WARNING: with the default GET method every request
// is a real visit, so this ADDS --requests clicks to the link. Use a throwaway
// link (create one on the Home page), or --method=HEAD.
//
// What the numbers mean:
//   p50 = the typical request.  p95 / p99 = the slow ones (1 in 20 / 1 in 100).
//   Users feel the slow ones, which is why averages hide problems.

const mongoose = require("mongoose");
const env = require("../config/env");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const BASE = arg("base", `http://localhost:${env.port}`).replace(/\/+$/, "");
const CODE = arg("code");
const REQUESTS = Number(arg("requests", 2000));
const CONCURRENCY = Number(arg("concurrency", 20));
const METHOD = arg("method", "GET").toUpperCase();

if (!CODE) {
  console.error("Usage: node scripts/redirect-bench.js --code=<shortCode> [--requests=2000] [--concurrency=20] [--method=GET|HEAD]");
  process.exit(1);
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const fmt = (n) => `${n.toFixed(2)} ms`;

async function readClicks(collection) {
  const doc = await collection.findOne({ shortCode: CODE }, { projection: { clicks: 1 } });
  return doc ? doc.clicks : null;
}

(async () => {
  let collection = null;
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 3000 });
    collection = mongoose.connection.db.collection("urls");
  } catch {
    console.log("(Could not reach the database, so the click-count check is skipped.)");
  }
  const clicksBefore = collection ? await readClicks(collection) : null;

  console.log(`\n${METHOD} ${BASE}/${CODE}   ${REQUESTS} requests, ${CONCURRENCY} at a time`);
  if (METHOD === "GET") console.log(`(this adds ${REQUESTS} clicks to the link)`);

  // Warm-up: opens connections and warms code paths so they don't skew the numbers.
  for (let i = 0; i < 20; i++) await fetch(`${BASE}/${CODE}`, { method: "HEAD", redirect: "manual" });

  const latencies = [];
  const statuses = {};
  let next = 0;
  const startedAt = performance.now();

  async function worker() {
    while (next < REQUESTS) {
      next++;
      const t0 = performance.now();
      try {
        const res = await fetch(`${BASE}/${CODE}`, { method: METHOD, redirect: "manual" });
        await res.arrayBuffer();
        statuses[res.status] = (statuses[res.status] || 0) + 1;
      } catch (err) {
        statuses[`error:${err.cause?.code ?? err.message}`] = (statuses[`error:${err.cause?.code ?? err.message}`] || 0) + 1;
      }
      latencies.push(performance.now() - t0);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seconds = (performance.now() - startedAt) / 1000;

  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((sum, n) => sum + n, 0) / latencies.length;
  console.log(`\nfinished in ${seconds.toFixed(2)} s  =>  ${(REQUESTS / seconds).toFixed(0)} requests/second`);
  console.log(`latency   min ${fmt(latencies[0])} | avg ${fmt(avg)} | p50 ${fmt(percentile(latencies, 50))} | p95 ${fmt(percentile(latencies, 95))} | p99 ${fmt(percentile(latencies, 99))} | max ${fmt(latencies.at(-1))}`);
  console.log(`responses ${JSON.stringify(statuses)}`);

  if (collection && clicksBefore !== null) {
    const counted = (await readClicks(collection)) - clicksBefore - 0; // (warm-up used HEAD: counts nothing)
    const expected = METHOD === "GET" ? (statuses[302] || 0) : 0;
    console.log(`\nclick check: ${expected} redirects were answered, the database counted ${counted}`);
    if (counted === expected) {
      console.log(METHOD === "GET" ? "  OK: every visit was counted exactly once." : "  OK: HEAD requests counted nothing, as they should.");
    }
    else console.log(`  MISMATCH of ${expected - counted}. Others may have visited the link meanwhile, but if not, clicks are being lost.`);
  }
  if (collection) await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
