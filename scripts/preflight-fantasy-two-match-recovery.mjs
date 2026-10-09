#!/usr/bin/env node
// Read-only live roster preflight. Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
// and SUPABASE_SECRET_KEY. Does not mutate any tables.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const data=JSON.parse(readFileSync(new URL("./fantasy-two-match-recovery-events.json",import.meta.url),"utf8"));
if(data.status!=="staged-not-approved")throw new Error("Unexpected recovery state");
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error("Missing Supabase environment variables");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let failed=false;
for(const match of data.matches){
 const {data:games,error:gameError}=await db.from("fantasy_games").select("id,external_id,home_score,away_score,season,status").eq("external_id",match.externalId).eq("season","2026/27");
 if(gameError)throw gameError;
 if(games?.length!==1){console.error("FAIL game identity",match.externalId,games?.length);failed=true;continue;}
 const game=games[0];
 if(game.status!=="finished"||Number(game.home_score)!==match.finalScore.home||Number(game.away_score)!==match.finalScore.away){console.error("FAIL game score/status",match.externalId);failed=true;continue;}
 const ids=[...new Set(match.events.flatMap(e=>[e.scorer,...e.assists]))];
 const {data:players,error:playerError}=await db.from("fantasy_players").select("id,name,external_id").in("external_id",ids);
 if(playerError)throw playerError;
 const byExternal=new Map();
 for(const p of players??[]){const arr=byExternal.get(p.external_id)||[];arr.push(p);byExternal.set(p.external_id,arr);}
 const playerIds=(players??[]).map(p=>p.id);
 const {data:stats,error:statsError}=await db.from("fantasy_player_game_stats").select("player_id,goals,assists,powerplay_goals,powerplay_assists").eq("game_id",game.id).in("player_id",playerIds);
 if(statsError)throw statsError;
 const roster=new Set((stats??[]).map(s=>s.player_id));
 const issues=[];
 for(const id of ids){const found=byExternal.get(id)||[];if(found.length!==1)issues.push(`${id}: ${found.length} player records`);else if(!roster.has(found[0].id))issues.push(`${id}: missing game stats row`);}
 const importedGoals=(stats??[]).reduce((sum,s)=>sum+Number(s.goals||0),0);
 const pending=match.events.filter(e=>e.time===null||/pending|provisional/i.test(e.note||"")).length;
 console.log(JSON.stringify({match:match.externalId,events:match.events.length,participants:ids.length,participantsWithGameRows:ids.length-issues.length,existingParticipantGoals:importedGoals,sourceConfirmationsPending:pending,issues},null,2));
 if(issues.length)failed=true;
}
if(failed){console.error("FAIL: unresolved roster identity; no writes performed");process.exitCode=1;}
else console.log("PASS: all staged participants uniquely match rostered game-stat players; no writes performed.");
