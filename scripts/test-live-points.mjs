import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {liveMatchStats,lineupPoints}=require('../lib/fantasy/live-points.ts');
const {calculateTipPoints}=require('../lib/score-engine.ts');
const bundle={matchId:8393595,players:[{personId:7969949,shots:2,pim:4,playerTime:16}],goalies:[{personId:1,saves:20,goalsAgainst:0,playerTimeSeconds:1200}],goals:[],penalties:[],teamMembers:[],tournamentPlayers:[],availability:{players:true,goalies:true,goals:true,penalties:true,teamMembers:true}};
const stats=liveMatchStats(bundle,'Home','Away');
assert.equal(stats.points('nif:7969949','W'),0,'Berglund: +2 participation +2 shots -4 PIM');
assert.equal(stats.points('nif:1','G'),12,'No premature win or shutout');
assert.deepEqual(stats.score,{homeScore:0,awayScore:0});
const missing=liveMatchStats({...bundle,availability:{...bundle.availability,goalies:false}},'Home','Away');
assert.equal(missing.points('nif:1','G'),null);assert.equal(missing.complete,false);
assert.equal(liveMatchStats({...bundle,players:[]},'Home','Away').points('nif:7969949','W'),null);
assert.equal(stats.points('','W'),null);
const idle=liveMatchStats({...bundle,players:[{personId:1}],goalies:[]},'Home','Away');
assert.equal(idle.score,null);assert.equal(idle.points('nif:1','W'),null);
const goal={homeOrAwayTeam:'h',goalType:'Even strength',onIceHomeTeamPersonIDs:'7969949',onIceAwayTeamPersonIDs:'2'};
const scored=liveMatchStats({...bundle,goals:[goal]},'Home','Away');
assert.deepEqual(scored.score,{homeScore:1,awayScore:0});assert.equal(scored.points('nif:7969949','W'),1);
assert.equal(calculateTipPoints(1,0,scored.score.homeScore,scored.score.awayScore),5);
assert.equal(liveMatchStats({...bundle,goals:[{...goal,periodName:'Shootout'}]},'Home','Away').score,null);
assert.equal(liveMatchStats({...bundle,goals:[{...goal,homeOrAwayTeam:'?'}]},'Home','Away').score,null);
assert.equal(lineupPoints(10,1,true,false),20);
assert.equal(lineupPoints(8,1,false,true),12);
assert.equal(lineupPoints(6,2,false,false),3);
assert.equal(lineupPoints(10,2,true,false,{captain:3,line2:1}),30);
assert.equal(lineupPoints(-.5,2,false,true),-.38,'Matches Postgres negative rounding');
assert.equal(lineupPoints(10+6,2,false,true),12,'Aggregate multi-game round before multipliers');
console.log('PASS live stats, Berglund, missing/empty feeds, no premature goalie bonuses, tipping scores and lineup rounding');
// Exercise the complete read-only service with database and source boundaries mocked.
const Module=require('node:module'), originalLoad=Module._load;
const now=Date.now(), before=new Date(now-3600000).toISOString(), future=new Date(now+3600000).toISOString();
const tables={
 fantasy_rounds:[{id:'r',round_no:4,deadline_at:before}],
 fantasy_games:[{id:'done',external_id:'hockeylive:1',starts_at:before,status:'finished',fantasy_round_id:'r'},{id:'live',external_id:'hockeylive:2',starts_at:before,status:'scheduled',fantasy_round_id:'r',home_team:'Home',away_team:'Away'}],
 fantasy_team_round_snapshots:[{id:'s',round_id:'r',team_id:'t',team_name:'Eligible'},{id:'late',round_id:'r',team_id:'late',team_name:'Late entrant'}],
 fantasy_season_rules:[],fantasy_scoring_rules:[],
 fantasy_team_round_snapshot_players:[{snapshot_id:'s',player_id:'p',position:'W',line_no:1,is_captain:true},{snapshot_id:'late',player_id:'p',position:'W',line_no:1,is_captain:true}],
 fantasy_user_teams:[{id:'t',created_at:before},{id:'late',created_at:future}],fantasy_players:[{id:'p',external_id:'nif:7969949'}],
 fantasy_player_points:[{game_id:'done',player_id:'p',actual_points:8},{game_id:'done',player_id:'p',actual_points:10}],
};
const fakeDb={from(table){assert.ok(table in tables,`Unexpected table ${table}`);let from=0,to=999;const q={select(){return q},eq(){return q},neq(){return q},lte(){return q},gte(){return q},in(){return q},order(){return q},range(a,b){from=a;to=b;return q},then(resolve){return Promise.resolve({data:tables[table].slice(from,to+1),error:null}).then(resolve)}};return q}};
Module._load=function(id,...args){if(id==='@supabase/supabase-js')return {createClient:()=>fakeDb};return originalLoad.call(this,id,...args)};
const nif=require('../lib/fantasy/nif-client.ts'), originalBundle=nif.fetchNifMatchBundle;
nif.fetchNifMatchBundle=async()=>({...bundle,players:[{personId:7969949,shots:1}],goalies:bundle.goalies});
try{
 const {getLivePoints}=require('../lib/fantasy/live-service.ts');
 const projection=await getLivePoints();
 assert.equal(projection.rounds[0].teams.length,1,'Late entrant receives no retroactive projection');
 assert.equal(projection.rounds[0].teams[0].points,26,'Latest final 10 plus live 3, captain x2, no double counting');
 assert.equal(projection.rounds[0].teams[0].missing,0);
 assert.equal(projection.matches.length,1,'Only unfinished game fetched live');
 tables.fantasy_rounds=[];
 assert.deepEqual((await getLivePoints()).rounds,[],'Finalized rounds leave live view');
 console.log('PASS projection integration: frozen lineup, late entry exclusion, latest official score, live combination and final handover');
}finally{Module._load=originalLoad;nif.fetchNifMatchBundle=originalBundle}
