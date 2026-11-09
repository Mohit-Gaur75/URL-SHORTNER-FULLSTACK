const { Queue, Worker } = require("bullmq");
const env = require("../config/env");
const { createConnection } = require("./connection");
const { flushClicks } = require("./clickFlush.job");

const QUEUE_NAME = "maintenance";
const FLUSH_CLICKS = "flush-clicks";

let queue = null;
let worker = null;
let connections = [];

async function processor(job) {
  if (job.name === FLUSH_CLICKS) return flushClicks();
  throw new Error(`Unknown job: ${job.name}`);
}

async function startJobs() {
  if (!env.redisUrl) {
    console.log("ℹ️  REDIS_URL not set: background jobs are disabled");
    return;
  }
  if (worker) return;

  const queueConnection = createConnection();
  const workerConnection = createConnection();
  connections = [queueConnection, workerConnection];

  queue = new Queue(QUEUE_NAME, { connection: queueConnection });
  await queue.setGlobalConcurrency(1);
  await queue.upsertJobScheduler(
    FLUSH_CLICKS,
    { every: env.clickFlushIntervalSeconds * 1000 },
    {
      name: FLUSH_CLICKS,
      opts: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 20,
        removeOnFail: 500,
      },
    }
  );

  worker = new Worker(QUEUE_NAME, processor, { connection: workerConnection, concurrency: 1 });
  worker.on("error", (err) => console.warn("[jobs] worker error:", err.message));
  worker.on("failed", (job, err) =>
    console.error(`[jobs] ${job?.name} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`, err.message)
  );

  console.log(`✅ Background jobs started (click flush every ${env.clickFlushIntervalSeconds}s)`);
}

async function stopJobs() {
  if (worker) await worker.close();
  if (queue) await queue.close();
  await Promise.all(connections.map((connection) => connection.quit().catch(() => {})));
  worker = null;
  queue = null;
  connections = [];
}

module.exports = { startJobs, stopJobs };
