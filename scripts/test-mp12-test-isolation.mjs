import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const removal = read("supabase/mp12-remove-unsafe-legacy-e2e-v1.sql");
const safeAutomation = read("supabase/v0.27.1-fantasy-round-automation-e2e.sql");
const safeRoundDetails = read("supabase/v0.29.1-fantasy-my-round-details-e2e.sql");
const safeTeamScoring = read("supabase/mp12-team-scoring-schema-bridge-v1.sql");
const safeSnapshot = read("supabase/mp12-snapshot-freeze-e2e-v1.sql");
const safeDgwBlank = read("supabase/mp12-dgw-blank-week-e2e-v1.sql");

const unsafeSignatures = [
  "public.create_fantasy_snapshot_test_round(text)",
  "public.get_fantasy_snapshot_test_state(text)",
  "public.cleanup_fantasy_snapshot_test_round(text)",
  "public.create_fantasy_scoring_e2e_test(text)",
  "public.run_fantasy_scoring_e2e_test(text)",
  "public.cleanup_fantasy_scoring_e2e_test(text)",
  "public.run_fantasy_transfers_e2e_test()",
  "public.run_fantasy_captain_vice_e2e_test()",
];

for (const signature of unsafeSignatures) {
  assert.ok(removal.includes(`drop function if exists ${signature};`), `Legacy E2E helper must remain removed until rewritten with synthetic season: ${signature}`);
  console.log(`PASS blocked legacy production-namespace helper: ${signature}`);
}

assert.ok(safeAutomation.includes("__e2e_v027__"), "Round automation E2E must use synthetic season");
assert.ok(safeAutomation.includes("No production 2026/27 round/game/team row is updated"), "Round automation E2E must document production isolation");
console.log("PASS round automation E2E synthetic-season isolation");

assert.ok(safeRoundDetails.includes("__e2e_my_round_details__"), "Round-details E2E must use synthetic season");
assert.ok(safeRoundDetails.includes("Everything created is removed before return"), "Round-details E2E must document cleanup");
console.log("PASS round-details E2E synthetic-season isolation");

assert.ok(safeTeamScoring.includes("__e2e_mp12_team_scoring__"), "Team-scoring E2E must use synthetic season");
assert.ok(!safeTeamScoring.includes("v_season constant text:='2026/27'"), "Team-scoring E2E must never use production season as its namespace");
console.log("PASS team-scoring E2E synthetic-season isolation");

assert.ok(safeSnapshot.includes("__e2e_mp12_snapshot__"), "Snapshot E2E must use synthetic season");
assert.ok(!safeSnapshot.includes("v_season constant text:='2026/27'"), "Snapshot E2E must never use production season as its namespace");
console.log("PASS snapshot E2E synthetic-season isolation");

assert.ok(safeDgwBlank.includes("__e2e_mp12_dgw_blank__"), "DGW/blank-week E2E must use synthetic season");
assert.ok(!safeDgwBlank.includes("v_season constant text:='2026/27'"), "DGW/blank-week E2E must never use production season as its namespace");
console.log("PASS DGW/blank-week E2E synthetic-season isolation");

console.log("\nPASS MP-12 test-isolation gate.");
