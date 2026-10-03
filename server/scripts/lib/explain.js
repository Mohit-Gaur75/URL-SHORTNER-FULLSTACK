// Reads the output of MongoDB's `explain()` and boils it down to the facts we
// care about: did it use an index, did it have to sort in memory, and how much
// work did it do?

// Collects `stage` / `indexName` values from a plan tree, top-down.
function walk(node, found) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, found));
  } else if (node && typeof node === "object") {
    if (typeof node.stage === "string") found.stages.push(node.stage);
    if (typeof node.indexName === "string") found.indexNames.push(node.indexName);
    Object.values(node).forEach((child) => walk(child, found));
  }
}

function summarizeExplain(explain) {
  // Only the WINNING plan matters; `rejectedPlans` are the ones MongoDB discarded.
  const winning = explain?.queryPlanner?.winningPlan;
  if (!winning) return { recognized: false };

  const found = { stages: [], indexNames: [] };
  walk(winning, found);

  const stats = explain.executionStats ?? {};
  return {
    recognized: true,
    stages: found.stages.filter((stage, i) => stage !== found.stages[i - 1]),
    indexName: found.indexNames[0] ?? null,
    usesIndex: found.stages.some((stage) => /IXSCAN/.test(stage)),
    scansWholeCollection: found.stages.includes("COLLSCAN"),
    sortsInMemory: found.stages.some((stage) => /^SORT/.test(stage)),
    returned: stats.nReturned ?? null,
    keysExamined: stats.totalKeysExamined ?? null,
    docsExamined: stats.totalDocsExamined ?? null,
    millis: stats.executionTimeMillis ?? null,
  };
}

module.exports = { summarizeExplain };
