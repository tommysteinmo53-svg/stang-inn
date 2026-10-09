#!/usr/bin/env node
// Verify the SQL preview matches the staged events. No network or database writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const events=JSON.parse(readFileSync(new URL("./fantasy-two-match-recovery-events.json",import.meta.url),"utf8"));
const sql=readFileSync(new URL("./dry-run-fantasy-two-match-recovery.sql",import.meta.url),"utf8");
const start=sql.indexOf(" values\n");
const end=sql.indexOf("\n)\nselect",start);
assert.ok(start>=0&&end>start,"SQL staged VALUES section missing");
const actual=new Map();
for(const match of sql.slice(start+8,end).matchAll(/\('([^']+)','([^']+)',(\d+),(\d+),(\d+),(\d+)\)/g)){
 const [_,game,id,...numbers]=match;
 const key=`${game}|${id}`;
 assert.ok(!actual.has(key),`Duplicate SQL row: ${key}`);
 actual.set(key,numbers.map(Number));
}
const expected=new Map();
for(const match of events.matches){
 for(const e of match.events){
  const participants=[[e.scorer,"goal"],...e.assists.map(id=>[id,"assist"])];
  for(const [id,kind] of participants){
   const key=`${match.externalId}|${id}`;
   const row=expected.get(key)||[0,0,0,0];
   if(kind==="goal"){row[0]++;if(e.strength==="PP")row[2]++;}
   else{row[1]++;if(e.strength==="PP")row[3]++;}
   expected.set(key,row);
  }
 }
}
assert.equal(actual.size,expected.size,"SQL preview row count differs from event participants");
for(const [key,counts] of expected)assert.deepEqual(actual.get(key),counts,`SQL mismatch for ${key}`);
const pending=events.matches.flatMap(m=>m.events.filter(e=>e.time===null||/pending|provisional/i.test(e.note||"")).map(e=>`${m.matchId}:${e.scorer}`));
console.log(`PASS: SQL preview exactly matches ${events.matches.reduce((n,m)=>n+m.events.length,0)} staged events and ${expected.size} unique match/player pairs.`);
if(pending.length)console.log(`NOT APPROVED FOR WRITES: ${pending.length} pending source confirmations: ${pending.join(", ")}`);
