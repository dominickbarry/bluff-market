// Runs every test suite as a child process and aggregates the results, so
// `npm test` is one command (and CI fails if any suite fails). Each suite
// exits non-zero on failure. test-diag.js is a balance diagnostic (informational
// win-rate numbers, no hard pass/fail), so it's run but not gated.
const { spawnSync } = require("child_process");

const gating = ["test-harness.js", "test-anim.js", "test-flow.js", "test-live.js", "test-tuning.js", "test-stats.js"];
const informational = ["test-diag.js"];

let failed = 0;
function run(file, gate) {
  process.stdout.write(`\n=== ${file}${gate ? "" : " (informational)"} ===\n`);
  const r = spawnSync(process.execPath, [file], { stdio: "inherit" });
  if (gate && r.status !== 0) { failed++; console.log(`!! ${file} FAILED (exit ${r.status})`); }
  return r.status;
}

gating.forEach(f => run(f, true));
informational.forEach(f => run(f, false));

console.log("\n=======================================");
if (failed === 0) { console.log("ALL GATING SUITES PASSED ✅"); process.exit(0); }
else { console.log(`${failed} SUITE(S) FAILED ❌`); process.exit(1); }
