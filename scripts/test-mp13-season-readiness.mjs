import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const tips = read("app/tips/page.tsx");
const tableTips = read("app/tabletips/page.tsx");
const awards = read("app/awards/page.tsx");
const profile = read("app/player/[id]/page.tsx");
const scoring = read("lib/score-engine.ts");
const tipIntegrity = read("supabase/mp13-tip-write-integrity-v1.sql");
const tableContract = read("supabase/mp13-table-tips-contract-v1.sql");

const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false, error }); }
}

check("Kamptips har komplett brukerflyt og klientlås", () => {
  assert.match(tips, /from\("tips"\)\.upsert/);
  assert.match(tips, /onConflict: "player_id,match_id"/);
  assert.match(tips, /function locked\(match: Match/);
  assert.match(tips, /filter==="untipped"/);
  assert.match(tips, /NESTE FRIST/);
  assert.match(tips, /type="number" min="0"/);
  assert.doesNotMatch(tips, /points\s*:/);
});

check("Kamptips-score eies av produksjonsmotoren", () => {
  assert.match(scoring, /export function calculateTipPoints/);
  assert.match(tipIntegrity, /revoke insert, update on table public\.tips from authenticated/);
  assert.match(tipIntegrity, /grant insert \(player_id, match_id, home_tip, away_tip\)/);
  assert.match(tipIntegrity, /grant update \(player_id, match_id, home_tip, away_tip\)/);
  assert.doesNotMatch(tipIntegrity, /grant (insert|update)[^\n]*points/i);
  assert.match(tipIntegrity, /tips_home_tip_nonnegative/);
  assert.match(tipIntegrity, /tips_away_tip_nonnegative/);
});

check("Server-side kampdeadline feiler lukket", () => {
  assert.match(tableContract, /create or replace function public\.guard_tip_deadline\(\)/);
  assert.match(tableContract, /if kickoff is null then/);
  assert.match(tableContract, /if now\(\) >= kickoff then/);
  assert.match(tableContract, /Tipset er låst fordi kampen har startet/);
});

check("Tabelltips lagres bare gjennom hardnet RPC", () => {
  assert.match(tableTips, /rpc\("save_table_tip_rankings"/);
  assert.doesNotMatch(tableTips, /from\("table_tips"\)\.(insert|upsert|update|delete)/);
  assert.match(tableContract, /auth\.uid\(\)/);
  assert.match(tableContract, /Tabelltips-konfigurasjon mangler/);
  assert.match(tableContract, /nøyaktig 10 lag/);
  assert.match(tableContract, /count\(distinct team\)/);
  assert.match(tableContract, /ehl_standings/);
  assert.match(tableContract, /revoke execute on function public\.save_table_tip_rankings\(text\[\]\) from anon/);
  assert.match(tableContract, /grant execute on function public\.save_table_tip_rankings\(text\[\]\) to authenticated/);
});

check("Tabelltips deadline og innsyn er eksplisitt i brukerflyten", () => {
  assert.match(tableTips, /setLocked\(Boolean\(nextDeadline/);
  assert.match(tableTips, /Tabelltipset er låst/);
  assert.match(tableTips, /Skjult frem til fristen/);
  assert.match(tableContract, /return true;/);
  assert.match(tableContract, /now\(\) >= deadline_value/);
});

check("MP-13.4 awards er samlet og bruker autoritative poeng", () => {
  for (const title of ["Rundevinner", "Månedsvinner", "Eksperttittel", "Sniper", "Beste streak", "Ukens bom", "Sesongens bom"]) {
    assert.match(awards, new RegExp(`title: "${title}"`));
  }
  assert.match(awards, /tip\.points !== null/);
  assert.doesNotMatch(awards, /resolvedPoints/);
  assert.match(awards, /Math\.ceil\(finished\.length \* 0\.75\)/);
});

check("Poeng- og rankutvikling finnes på spillerprofil", () => {
  assert.match(profile, /type TrendPoint = \{ round:number; cumulative:number; position:number \}/);
  assert.match(profile, /Sesongutvikling/);
  assert.match(profile, /Poeng og plassering per runde/);
  assert.match(profile, /cumulative/);
  assert.match(profile, /position/);
});

check("Readiness-gaten er produksjonssikker", () => {
  const own = read("scripts/test-mp13-season-readiness.mjs");
  const serviceRoleEnv = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
  assert.equal(own.includes(serviceRoleEnv), false);
  assert.doesNotMatch(own, /createClient\(/);
  assert.doesNotMatch(own, /\.insert\(/);
  assert.doesNotMatch(own, /\.update\(/);
  assert.doesNotMatch(own, /\.delete\(/);
  assert.doesNotMatch(own, /\.upsert\(/);
});

let failed = 0;
for (const result of checks) {
  if (result.pass) console.log(`PASS ${result.name}`);
  else { failed += 1; console.error(`FAIL ${result.name}`); console.error(result.error); }
}
if (failed) {
  console.error(`\nMP-13 season readiness failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`\nPASS ${checks.length}/${checks.length} MP-13 season readiness checks.`);
