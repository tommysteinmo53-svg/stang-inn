#!/usr/bin/env node
// Read-only validation of staged recovery data. Never writes to Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const path = new URL("./fantasy-two-match-recovery-events.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
assert.equal(data.schemaVersion, 1);
assert.ok(["staged-not-approved", "official-screenshots-verified-for-8393611;8393583-requires-final-source-check", "production-repaired-and-verified"].includes(data.status), "Unexpected recovery verification status");
assert.equal(data.matches.length, 2);
const expected = new Map([[8393583,{goals:5,home:4,away:1}],[8393611,{goals:9,home:6,away:3}]]);
const seen = new Set();
let pending = 0;
for (const match of data.matches) {
  assert.ok(expected.has(match.matchId), "Unexpected match");
  assert.ok(!seen.has(match.matchId), "Duplicate match");
  seen.add(match.matchId);
  const want = expected.get(match.matchId);
  assert.deepEqual(match.finalScore,{home:want.home,away:want.away});
  assert.equal(match.events.length,want.goals);
  assert.ok(match.sources.length >= 1);
  const keys = new Set();
  for (const event of match.events) {
    assert.match(event.scorer,/^(nif|ep):\d+$/);
    assert.ok(Array.isArray(event.assists));
    assert.ok(event.assists.length <= 2);
    assert.equal(new Set(event.assists).size,event.assists.length);
    assert.ok(!event.assists.includes(event.scorer));
    for(const id of event.assists)assert.match(id,/^(nif|ep):\d+$/);
    assert.ok(["EV","PP","SH","EN","PS"].includes(event.strength));
    if (event.time === null || event.note?.includes("provisional") || event.note?.includes("pending")) pending++;
    if(event.time !== null)assert.match(event.time,/^\d{2}:\d{2}$/);
    const key=`${event.time}:${event.scorer}`;
    assert.ok(!keys.has(key),"Duplicate event");
    keys.add(key);
  }
}
assert.equal(seen.size,2);
console.log(`PASS: validated ${[...expected.values()].reduce((sum,x)=>sum+x.goals,0)} events across 2 matches; ${pending} pending source confirmations. No database writes.`);
