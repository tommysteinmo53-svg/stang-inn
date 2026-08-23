import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const scoringPath = "lib/score-engine.ts";
const syncPath = "lib/sync-service.ts";
const awardsPath = "app/awards/page.tsx";
const scoringSource = fs.readFileSync(scoringPath, "utf8");
const syncSource = fs.readFileSync(syncPath, "utf8");
const awardsSource = fs.readFileSync(awardsPath, "utf8");

const compiled = ts.transpileModule(scoringSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: scoringPath,
});
const module = { exports: {} };
new Function("exports", "module", "require", compiled.outputText)(module.exports, module, () => {
  throw new Error("Tipping score engine unexpectedly imported a runtime dependency");
});
const { calculateTipPoints } = module.exports;
assert.equal(typeof calculateTipPoints, "function", "Production tipping scoring function must be loadable");

const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false, error }); }
}

check("Eksakt resultat gir 5 poeng", () => assert.equal(calculateTipPoints(4, 2, 4, 2), 5));
check("Riktig hjemmeseier gir 3 poeng", () => assert.equal(calculateTipPoints(3, 1, 5, 2), 3));
check("Riktig borteseier gir 3 poeng", () => assert.equal(calculateTipPoints(1, 4, 2, 3), 3));
check("Riktig uavgjort utfall gir 3 poeng", () => assert.equal(calculateTipPoints(2, 2, 1, 1), 3));
check("Feil utfall gir 0 poeng", () => assert.equal(calculateTipPoints(2, 1, 1, 3), 0));
check("Konfigurerbare poengregler brukes av samme produksjonsfunksjon", () => {
  assert.equal(calculateTipPoints(2, 1, 2, 1, { exact: 7, outcome: 4 }), 7);
  assert.equal(calculateTipPoints(3, 1, 2, 0, { exact: 7, outcome: 4 }), 4);
});

check("Scoringmotoren er eksplisitt idempotent og verifiserer lagret poeng", () => {
  assert.match(scoringSource, /Recalculates points for every tip belonging to a finished match/);
  assert.match(scoringSource, /if \(tip\.points === points\) continue;/);
  assert.match(scoringSource, /Scoring ble ikke lagret for tips/);
});
check("EHL-synk scorer tipping etter kamp-upsert", () => {
  const upsertIndex = syncSource.indexOf('.from("matches").upsert');
  const scoreIndex = syncSource.indexOf("scoreFinishedMatches(supabase)");
  assert.ok(upsertIndex >= 0 && scoreIndex > upsertIndex);
});
check("Gjenåpnet eller uklar kamp nullstiller gamle tippingpoeng før ny scoring", () => {
  const clearIndex = syncSource.indexOf("update({ points: null })");
  const scoreIndex = syncSource.indexOf("scoreFinishedMatches(supabase)");
  assert.ok(clearIndex >= 0 && scoreIndex > clearIndex);
});
check("Fantasy-livssyklus er separat fra tipping-scoring i synktjenesten", () => {
  const tippingScoreIndex = syncSource.indexOf("scoreFinishedMatches(supabase)");
  const fantasyScheduleIndex = syncSource.indexOf("syncFantasySchedule()");
  assert.ok(tippingScoreIndex >= 0 && fantasyScheduleIndex > tippingScoreIndex);
});

check("Awards bruker bare autoritativt lagrede tippingpoeng", () => {
  assert.match(awardsSource, /tip\.points !== null/);
  assert.match(awardsSource, /Number\(tip\.points \?\? 0\)/);
  assert.doesNotMatch(awardsSource, /resolvedPoints/);
  assert.doesNotMatch(awardsSource, /return 5;/);
  assert.doesNotMatch(awardsSource, /\?3:0/);
});
check("Månedsvinner kåres bare for avsluttet kalendermåned", () => {
  assert.match(awardsSource, /function monthIsClosed/);
  assert.match(awardsSource, /closedScoredMonths/);
  assert.match(awardsSource, /title: "Månedsvinner"/);
  assert.match(awardsSource, /Kåres etter første avsluttede kalendermåned med scorede tips/);
});
check("Månedsvinner bruker samme poeng- og tie-break-rekkefølge som rundevinner", () => {
  const monthlyBlock = awardsSource.slice(awardsSource.indexOf("let monthlyWinner"), awardsSource.indexOf("const chooseMiss"));
  assert.match(monthlyBlock, /b\.points - a\.points/);
  assert.match(monthlyBlock, /b\.exact - a\.exact/);
  assert.match(monthlyBlock, /b\.correct - a\.correct/);
  assert.match(monthlyBlock, /localeCompare\(b\.p\.display_name, "no"\)/);
});
check("Eksperttittel krever 75 prosent deltakelse og rangerer på treffprosent", () => {
  const expertBlock = awardsSource.slice(awardsSource.indexOf("const expertMinTips"), awardsSource.indexOf("let streak"));
  assert.match(expertBlock, /Math\.ceil\(finished\.length \* 0\.75\)/);
  assert.match(expertBlock, /row\.tipped >= expertMinTips/);
  assert.match(expertBlock, /\(row\.exact \+ row\.correct\) \/ row\.tipped/);
  assert.match(expertBlock, /b\.hitRate - a\.hitRate/);
  assert.match(expertBlock, /b\.exact - a\.exact/);
  assert.match(expertBlock, /b\.points - a\.points/);
  assert.match(expertBlock, /b\.correct - a\.correct/);
  assert.match(expertBlock, /localeCompare\(b\.p\.display_name, "no"\)/);
  assert.match(awardsSource, /title: "Eksperttittel"/);
  assert.match(awardsSource, /minst 75 % deltakelse/);
});
check("Ukens bom bruker siste fullførte EHL-runde og deterministisk avvik", () => {
  assert.match(awardsSource, /const completedRounds/);
  assert.match(awardsSource, /const latestRound = completedRounds\.at\(-1\)/);
  assert.match(awardsSource, /const weeklyRoundIds/);
  assert.match(awardsSource, /const weeklyMiss/);
  assert.match(awardsSource, /title: "Ukens bom"/);
  assert.match(awardsSource, /b\.distance - a\.distance/);
  assert.match(awardsSource, /a\.p\.display_name\.localeCompare/);
  assert.match(awardsSource, /a\.match\.id - b\.match\.id/);
});

let failed = 0;
for (const result of checks) {
  if (result.pass) console.log(`PASS ${result.name}`);
  else { failed += 1; console.error(`FAIL ${result.name}`); console.error(result.error); }
}
if (failed) {
  console.error(`\nMP-13 tipping scoring regression failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`\nPASS ${checks.length}/${checks.length} MP-13 tipping scoring regression checks.`);
