import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const migration=read("supabase/mp13-shared-private-leagues-v1.sql");
const joinFix=read("supabase/mp13-shared-private-leagues-v1-1.sql");
const hub=read("app/leagues/page.tsx");
const detail=read("app/leagues/[id]/page.tsx");
const fantasyHub=read("app/fantasy/leagues/page.tsx");
const fantasyDetail=read("app/fantasy/leagues/[id]/page.tsx");
const css=read("app/shared-leagues.css");
const layout=read("app/layout.tsx");

const checks=[];
function check(name,fn){try{fn();checks.push({name,pass:true})}catch(error){checks.push({name,pass:false,error})}}

check("Én kanonisk liga- og medlemsmodell",()=>{
 assert.match(migration,/create table if not exists public\.stang_inn_private_leagues/);
 assert.match(migration,/create table if not exists public\.stang_inn_private_league_members/);
 assert.match(migration,/primary key \(league_id,user_id\)/);
 assert.doesNotMatch(hub,/create_(fantasy|hockeytips)_private_league_v1/);
 assert.doesNotMatch(hub,/join_(fantasy|hockeytips)_private_league_v1/);
 assert.match(hub,/create_stang_inn_private_league_v1/);
 assert.match(hub,/join_stang_inn_private_league_v1/);
});

check("Legacy-ligaer migreres uten drop eller id-/kodebytte",()=>{
 assert.match(migration,/from public\.fantasy_private_leagues/);
 assert.match(migration,/from public\.hockeytips_private_leagues/);
 assert.match(migration,/from public\.fantasy_private_league_members/);
 assert.match(migration,/from public\.hockeytips_private_league_members/);
 assert.match(migration,/stang_inn_private_league_migration_audit/);
 assert.match(migration,/missing legacy league/);
 assert.match(migration,/missing legacy membership/);
 assert.doesNotMatch(migration,/drop table/i);
 assert.doesNotMatch(migration,/delete from public\.(fantasy_private|hockeytips_private)/i);
});

check("Gamle RPC-er er kun kompatibilitetswrappere",()=>{
 for(const fn of ["create_fantasy_private_league_v1","join_fantasy_private_league_v1","get_my_fantasy_private_leagues_v1","get_fantasy_private_league_standings_v1","create_hockeytips_private_league_v1","join_hockeytips_private_league_v1","get_my_hockeytips_private_leagues_v1","get_hockeytips_private_league_standings_v1"]){assert.match(migration,new RegExp(`function public\\.${fn}`))}
 assert.match(migration,/select public\.create_stang_inn_private_league_v1/);
 assert.match(migration,/select public\.join_stang_inn_private_league_v1/);
 assert.match(migration,/get_my_stang_inn_private_leagues_v1/);
});

check("Join-ambiguitet er eksplisitt reparert",()=>{
 assert.match(joinFix,/v_league_id uuid/);
 assert.match(joinFix,/values \(v_league_id,uid,'member'\)/);
 assert.match(joinFix,/on conflict \(league_id,user_id\) do nothing/);
});

check("Fantasy og Tipping har separate autoritative rankingflater",()=>{
 assert.match(migration,/get_stang_inn_private_league_fantasy_standings_v1/);
 assert.match(migration,/get_stang_inn_private_league_tipping_standings_v1/);
 assert.match(migration,/get_fantasy_competition_table_v2\(p_season\)/);
 assert.match(migration,/dense_rank\(\) over\(order by c\.total_points desc,c\.round_wins desc,c\.best_round_points desc\)/);
 assert.match(migration,/dense_rank\(\) over\(order by s\.total_points desc,s\.exact_results desc,s\.correct_outcomes desc,s\.display_name\)/);
});

check("Offentlig identitet er navn + Fantasy-lagnavn, aldri e-post",()=>{
 assert.match(migration,/p\.profile_name_confirmed_at is not null/);
 assert.match(migration,/coalesce\(b\.team_name,'Ikke opprettet lag'\)/);
 assert.match(detail,/r\.team_name/);
 assert.match(detail,/r\.display_name/);
 assert.doesNotMatch(detail,/email/i);
 assert.doesNotMatch(hub,/email/i);
});

check("Eier- og leave-regler gjelder felles medlemskap",()=>{
 assert.match(migration,/if member_role='owner' then raise exception/);
 assert.match(migration,/delete from public\.stang_inn_private_league_members/);
 assert.match(migration,/owner invariant/);
 assert.match(detail,/leave_stang_inn_private_league_v1/);
 assert.match(detail,/Du forlater både Tipping- og Fantasy-tabellen/);
});

check("RPC-surface er authenticated-only og tabeller er ikke klientskrivbare",()=>{
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on table public\.stang_inn_private_leagues from public,anon,authenticated/);
 assert.match(migration,/revoke all on table public\.stang_inn_private_league_members from public,anon,authenticated/);
 assert.match(migration,/revoke all on function %s from anon/);
 assert.match(migration,/grant execute on function %s to authenticated/);
 assert.match(joinFix,/revoke all on function public\.join_stang_inn_private_league_v1\(text,text\) from anon/);
});

check("Samme ligaside kan bytte mellom Tipping og Fantasy",()=>{
 assert.match(detail,/type View="tipping"\|"fantasy"/);
 assert.match(detail,/Tipping/);
 assert.match(detail,/Fantasy/);
 assert.match(detail,/get_stang_inn_private_league_tipping_standings_v1/);
 assert.match(detail,/get_stang_inn_private_league_fantasy_standings_v1/);
 assert.match(detail,/role="tablist"/);
});

check("Gamle Fantasy-ruter peker til den delte ligaen",()=>{
 assert.match(fantasyHub,/redirect\("\/leagues\?view=fantasy"\)/);
 assert.match(fantasyDetail,/redirect\(`\/leagues\/\$\{id\}\?view=fantasy`\)/);
});

check("Mobil og desktop har eksplisitt responsive liga-layout",()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(max-width:580px\)/);
 assert.match(css,/sharedLeagueRow\.tipping/);
 assert.match(css,/sharedLeagueRow\.fantasy/);
 assert.match(layout,/shared-leagues\.css/);
});

check("Regresjonstesten er read-only",()=>{
 const own=read("scripts/test-mp13-shared-leagues.mjs");
 assert.doesNotMatch(own,/createClient\(/);
 assert.doesNotMatch(own,/\.insert\(/);
 assert.doesNotMatch(own,/\.update\(/);
 assert.doesNotMatch(own,/\.delete\(/);
 assert.doesNotMatch(own,/\.upsert\(/);
});

let failed=0;
for(const result of checks){if(result.pass)console.log(`PASS ${result.name}`);else{failed++;console.error(`FAIL ${result.name}`);console.error(result.error)}}
if(failed){console.error(`\nMP-13.6 shared leagues failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`\nPASS ${checks.length}/${checks.length} MP-13.6 shared mini league checks.`);
