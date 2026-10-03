// Run with: npm test
// Pins down which indexes exist and WHY, so nobody adds or removes one by
// accident. If you change an index on purpose, update this test with it.
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:1/test";
process.env.JWT_SECRET = "t".repeat(40);
process.env.BASE_URL = "http://localhost:5000";

const test = require("node:test");
const assert = require("node:assert/strict");

const Url = require("../models/url.model");
const User = require("../models/user.model");
const { summarizeExplain } = require("../scripts/lib/explain");

// Mongoose lists indexes as [keys, options] pairs.
const describeIndexes = (Model) =>
  Model.schema.indexes().map(([keys, options]) => ({ keys, unique: Boolean(options.unique) }));

test("urls: exactly the indexes we decided on", () => {
  assert.deepEqual(describeIndexes(Url), [
    { keys: { shortCode: 1 }, unique: true }, //          the redirect lookup + collision guard
    { keys: { user: 1, createdAt: -1 }, unique: false }, // "my links, newest first"
  ]);
});

test("users: exactly one index, the unique email", () => {
  assert.deepEqual(describeIndexes(User), [{ keys: { email: 1 }, unique: true }]);
});

test("write-hot and unqueried fields are NOT indexed", () => {
  const indexedFields = new Set(describeIndexes(Url).flatMap((i) => Object.keys(i.keys)));
  // clicks / lastClickedAt change on every redirect: indexing them would make the
  // hottest request in the system update an index each time.
  for (const field of ["clicks", "lastClickedAt", "status", "expiresAt", "originalUrl", "updatedAt"]) {
    assert.equal(indexedFields.has(field), false, `${field} should not be indexed`);
  }
});

test("the compound index leads with the equality field, then the sort field", () => {
  const compound = describeIndexes(Url).find((i) => Object.keys(i.keys).length === 2);
  assert.deepEqual(Object.keys(compound.keys), ["user", "createdAt"]);
  assert.equal(compound.keys.createdAt, -1); // newest first, matching the list query
});

// ---- the explain() reader, checked against the plan shapes MongoDB documents ----

const stats = (docs, keys, returned, millis) => ({
  executionStats: { nReturned: returned, totalDocsExamined: docs, totalKeysExamined: keys, executionTimeMillis: millis },
});

test("explain: full collection scan with an in-memory sort", () => {
  const plan = summarizeExplain({
    queryPlanner: {
      winningPlan: { stage: "LIMIT", inputStage: { stage: "SORT", inputStage: { stage: "COLLSCAN" } } },
      // The planner considered an index and threw it away. It must be ignored.
      rejectedPlans: [{ stage: "FETCH", inputStage: { stage: "IXSCAN", indexName: "other_1" } }],
    },
    ...stats(100000, 0, 20, 48),
  });
  assert.deepEqual(plan.stages, ["LIMIT", "SORT", "COLLSCAN"]);
  assert.equal(plan.usesIndex, false);
  assert.equal(plan.scansWholeCollection, true);
  assert.equal(plan.sortsInMemory, true);
  assert.equal(plan.indexName, null);
  assert.deepEqual([plan.docsExamined, plan.keysExamined, plan.returned, plan.millis], [100000, 0, 20, 48]);
});

test("explain: compound index scan, no sort step", () => {
  const plan = summarizeExplain({
    queryPlanner: {
      winningPlan: {
        stage: "LIMIT",
        inputStage: { stage: "FETCH", inputStage: { stage: "IXSCAN", indexName: "user_1_createdAt_-1" } },
      },
    },
    ...stats(20, 20, 20, 0),
  });
  assert.deepEqual(plan.stages, ["LIMIT", "FETCH", "IXSCAN"]);
  assert.equal(plan.usesIndex, true);
  assert.equal(plan.sortsInMemory, false);
  assert.equal(plan.indexName, "user_1_createdAt_-1");
  assert.equal(plan.docsExamined, 20);
});

test("explain: the newer slot-based plan layout (queryPlan nested in winningPlan)", () => {
  const plan = summarizeExplain({
    queryPlanner: {
      winningPlan: {
        queryPlan: { stage: "LIMIT", inputStage: { stage: "FETCH", inputStage: { stage: "IXSCAN", indexName: "shortCode_1" } } },
        slotBasedPlan: { slots: "$$RESULT=s5", stages: "[1] limit 20 ..." },
      },
    },
    ...stats(1, 1, 1, 0),
  });
  assert.equal(plan.usesIndex, true);
  assert.equal(plan.indexName, "shortCode_1");
});

test("explain: output from a server we don't understand is reported, not guessed at", () => {
  assert.deepEqual(summarizeExplain({ queryPlanner: { Plan: ["SCAN urls"] } }), { recognized: false });
  assert.deepEqual(summarizeExplain(undefined), { recognized: false });
});
