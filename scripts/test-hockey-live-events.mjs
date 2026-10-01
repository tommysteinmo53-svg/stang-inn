import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {applyLiveMessages,liveEventsBundle,fetchHockeyLiveEvents}=require('../lib/fantasy/hockey-live-events.ts');
const {liveMatchStats}=require('../lib/fantasy/live-points.ts');
const metadata={MatchId:42,MatchEventType:'MatchData',ClientId:'md',HomePlayers:[{Id:1},{Id:2}],AwayPlayers:[{Id:3}],HomeGoalies:[{Id:4}],AwayGoalies:[{Id:5},{Id:6}]};
const goal={MatchId:42,MatchEventType:'Goal',ClientId:'g',Team:'H',Player:1,FirstAssist:2,Goalie:5,GoalType:200141,ActivePlayers:[1,2],Opponents:[3],TotalMatchTime:'01:00'};
const events=new Map();
const msg=(e,t='17908656278643337')=>({message:e,timetoken:t});
applyLiveMessages(events,[msg(metadata),msg(goal),msg({...goal,FirstAssist:null}),msg({...goal,MatchId:99,ClientId:'wrong'})],42);
assert.equal(events.size,2);assert.equal(events.get('g').FirstAssist,null);
const b=liveEventsBundle(42,[...events.values()]);
assert.equal(b.players.find(p=>p.personId===1).goalsScored,1);assert.equal(b.players.find(p=>p.personId===2).assists,0);
const stats=liveMatchStats(b,'H','A');assert.deepEqual(stats.score,{homeScore:1,awayScore:0});
assert.equal(stats.points('nif:1','W'),14); // 2 played +10 goal +1 shot +1 +/-
assert.equal(stats.points('nif:5','G'),-1); // 2 played -3 GA; no win/shutout
applyLiveMessages(events,[msg({MatchId:42,ClientId:'del',MatchEventType:'Delete',DeletedEventClientId:'g'})],42);
assert.equal(events.has('g'),false);assert.equal(liveMatchStats(liveEventsBundle(42,[...events.values()]),'H','A').score,null);
const zero=liveEventsBundle(42,[metadata,{MatchEventType:'Timer',Type:4}]);assert.deepEqual(liveMatchStats(zero,'H','A').score,{homeScore:0,awayScore:0});
const original=globalThis.fetch;let calls=0;
try {
 globalThis.fetch=async url=>{calls++;if(calls===1){const items=Array.from({length:100},(_,i)=>msg({...metadata,ClientId:`md${i}`}));return new Response(JSON.stringify([items,'17908656278643337','17908656278643339']))}assert.ok(String(url).includes('start=17908656278643339'));return new Response(JSON.stringify([[msg(goal)],'17908656278643340','17908656278643341']))};
 assert.equal((await fetchHockeyLiveEvents(42)).length,2);assert.equal(calls,2);
 await fetchHockeyLiveEvents(42);assert.equal(calls,2,'Shared completed history reused');
} finally {globalThis.fetch=original}
if(process.env.HOCKEY_EVENTS_FIXTURE){
 const raw=JSON.parse(fs.readFileSync(process.env.HOCKEY_EVENTS_FIXTURE,'utf8'));const resolved=new Map();applyLiveMessages(resolved,raw,8393600);
 const bundle=liveEventsBundle(8393600,[...resolved.values()]), live=liveMatchStats(bundle,'Stavanger','Ringerike');
 assert.deepEqual(live.score,{homeScore:4,awayScore:1});assert.ok(bundle.players.some(p=>p.shots>0));assert.ok(bundle.goalies.some(p=>p.saves>0));
 console.log('PASS actual in-progress October 1 replay: 1440 messages resolve to 4–1, shots and goalie saves');
}
console.log('PASS public event conversion, corrections, deletions, pre-game/0–0, goalie scoring and exact pagination cursor');
