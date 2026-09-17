import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {hockeyLiveResult}=require('../lib/providers/hockeylive-result.ts');
const {createHockeyLiveProvider,fetchHockeyLiveStandings}=require('../lib/providers/hockeylive.ts');
const {calculateTipPoints}=require('../lib/score-engine.ts');
const final={statusTypeId:1,matchResult:{homeGoals:2,awayGoals:0,matchEndResult:'2-0'}};
assert.deepEqual(hockeyLiveResult(final),{homeScore:2,awayScore:0,finished:true});
for(const raw of [{statusTypeId:1,matchResult:null},{statusTypeId:1,homeScore:3,awayScore:2,matchResult:null},{statusTypeId:1,homeScore:0,awayScore:0},{...final,matchResult:{homeGoals:2,awayGoals:0,matchEndResult:'3-0'}},{statusTypeId:1,finished:'false',homeScore:2,awayScore:1}])assert.equal(hockeyLiveResult(raw).finished,false);
assert.equal(hockeyLiveResult({...final,matchResult:{homeGoals:0,awayGoals:0,matchEndResult:'0-0'}}).finished,true);
assert.equal(calculateTipPoints(2,0,2,0),5);assert.equal(calculateTipPoints(3,1,2,0),3);assert.equal(calculateTipPoints(0,2,2,0),0);
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('TournamentStandings')?[{orgName:'Test',position:1,totalMatches:1,totalPoints:3}]:{matches:[{matchId:1,hometeam:'Home',awayteam:'Away',matchDate:'2026-09-16',matchStartTime:1900,...final}]}),{headers:{'content-type':'application/json'}});
 assert.equal((await createHockeyLiveProvider().fetchMatches())[0].finished,true);
 assert.deepEqual((await fetchHockeyLiveStandings())[0],{season:process.env.NIF_SEASON_LABEL||'2026/27',team:'Test',position:1,played:1,points:3});
 if(process.env.HOCKEY_MATCHES_JSON){
  const read=p=>{let b=fs.readFileSync(p);if(b[0]===31&&b[1]===139)b=zlib.gunzipSync(b);return JSON.parse(b)};
  globalThis.fetch=async url=>new Response(JSON.stringify(read(String(url).includes('TournamentStandings')?process.env.HOCKEY_STANDINGS_JSON:process.env.HOCKEY_MATCHES_JSON)),{headers:{'content-type':'application/json'}});
  const matches=await createHockeyLiveProvider().fetchMatches(),table=await fetchHockeyLiveStandings();
  assert.equal(matches.length,180);assert.equal(matches.filter(m=>m.finished).length,4);assert.equal(table.reduce((n,r)=>n+r.played,0),8);assert.equal(table.reduce((n,r)=>n+r.points,0),9);
  console.log('PASS live replay: 180 matches, 4 finals, 8 team appearances, 9 table points (including Lillehammer -3 deduction)');
 }
}finally{globalThis.fetch=originalFetch}
console.log('PASS official results, unplayed/live/malformed negatives, zero scores, tipping points and standings fields');
