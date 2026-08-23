import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourcePath = "lib/fantasy/scoring.ts";
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
});

const module = {exports: {}};
new Function("exports", "module", "require", compiled.outputText)(module.exports, module, () => {
  throw new Error("Fantasy scoring module unexpectedly imported a runtime dependency");
});

const {calculate19FantasyPoints} = module.exports;
assert.equal(typeof calculate19FantasyPoints, "function", "Production scoring function must be loadable");

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({name, pass: true});
  } catch (error) {
    checks.push({name, pass: false, error});
  }
}

check("Forward/skater base scoring and PIM cap", () => {
  const p = calculate19FantasyPoints({
    position: "W",
    didPlay: true,
    goals: 1,
    assists: 1,
    shots: 3,
    plusMinus: 2,
    pim: 14,
  });
  assert.deepEqual(
    {participation:p.participation,goals:p.goals,assists:p.assists,shots:p.shots,plusMinus:p.plusMinus,pim:p.pim,total:p.total},
    {participation:2,goals:10,assists:6,shots:3,plusMinus:2,pim:-10,total:13},
  );
});

check("Defender goal and assist values", () => {
  const p = calculate19FantasyPoints({position:"D",didPlay:true,goals:1,assists:1});
  assert.equal(p.participation, 2);
  assert.equal(p.goals, 15);
  assert.equal(p.assists, 8);
  assert.equal(p.total, 25);
});

check("Goalie play detection uses TOI/saves/goals against", () => {
  const p = calculate19FantasyPoints({
    position:"G",
    didPlay:false,
    minutesPlayed:0,
    saves:30,
    goalsAgainst:2,
    win:true,
    shutout:false,
  });
  assert.equal(p.participation, 2);
  assert.equal(p.saves, 15);
  assert.equal(p.goalsAgainst, -6);
  assert.equal(p.win, 5);
  assert.equal(p.total, 16);
});

check("Listed backup with zero goalie evidence gets zero participation", () => {
  const p = calculate19FantasyPoints({position:"G",didPlay:true,minutesPlayed:0,saves:0,goalsAgainst:0,win:false,shutout:false});
  assert.equal(p.participation, 0);
  assert.equal(p.saves, 0);
  assert.equal(p.goalsAgainst, 0);
  assert.equal(p.total, 0);
});

check("Goalie shutout and win bonuses require actual play", () => {
  const played = calculate19FantasyPoints({position:"G",minutesPlayed:60,saves:25,goalsAgainst:0,win:true,shutout:true});
  assert.equal(played.shutout, 10);
  assert.equal(played.win, 5);
  assert.equal(played.total, 29.5);
  const backup = calculate19FantasyPoints({position:"G",minutesPlayed:0,saves:0,goalsAgainst:0,win:true,shutout:true});
  assert.equal(backup.shutout, 0);
  assert.equal(backup.win, 0);
});

check("Special teams and faceoffs are inert by default", () => {
  const p = calculate19FantasyPoints({
    position:"C",didPlay:true,powerplayGoals:2,powerplayAssists:3,shorthandedGoals:1,shorthandedAssists:2,faceoffsWon:12,
  });
  assert.equal(p.powerplayGoals, 0);
  assert.equal(p.powerplayAssists, 0);
  assert.equal(p.shorthandedGoals, 0);
  assert.equal(p.shorthandedAssists, 0);
  assert.equal(p.faceoffsWon, 0);
  assert.equal(p.faceoffBonus, 0);
  assert.equal(p.total, 2);
});

check("Configured special teams and faceoff values are additive", () => {
  const p = calculate19FantasyPoints(
    {position:"C",didPlay:true,powerplayGoals:2,powerplayAssists:1,shorthandedGoals:1,shorthandedAssists:2,faceoffsWon:10},
    {powerplayGoalBonus:2,powerplayAssistBonus:1,shorthandedGoalBonus:3,shorthandedAssistBonus:2,faceoffWinPoints:.1,faceoffWinBonus:1.5},
  );
  assert.equal(p.powerplayGoals, 4);
  assert.equal(p.powerplayAssists, 1);
  assert.equal(p.shorthandedGoals, 3);
  assert.equal(p.shorthandedAssists, 4);
  assert.equal(p.faceoffsWon, 1);
  assert.equal(p.faceoffBonus, 1.5);
  assert.equal(p.total, 16.5);
});

check("Null/undefined/non-finite numeric inputs cannot poison totals", () => {
  const p = calculate19FantasyPoints({position:"W",didPlay:true,goals:null,assists:undefined,shots:Number.NaN,plusMinus:null,pim:undefined});
  assert.equal(p.total, 2);
  for (const value of Object.values(p)) assert.equal(Number.isFinite(value), true);
});

let failed = 0;
for (const result of checks) {
  if (result.pass) {
    console.log(`PASS ${result.name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${result.name}`);
    console.error(result.error);
  }
}

if (failed) {
  console.error(`\nMP-12 scoring regression failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`\nPASS ${checks.length}/${checks.length} MP-12 scoring regression checks.`);
