// In-memory PostgreSQL only: this test has no Supabase URL, credentials or network client.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const migration = fs.readFileSync("supabase/migrations/20260915101010_sparta_withdrawal_2026_27.sql", "utf8");
const db = new PGlite();
const uid = "00000000-0000-4000-8000-000000000001";
const otherUid = "00000000-0000-4000-8000-000000000002";
const teams = ["Storhamar", "Oilers", "Vålerenga", "Frisk Asker", "Sparta", "Narvik", "Stjernen", "Lillehammer", "Nidaros", "Ringerike"];
const active = teams.filter(t => t !== "Sparta");
const one = async sql => (await db.query(sql)).rows[0];

function existingFunction(path, name) {
  const source = fs.readFileSync(path, "utf8");
  const start = source.toLowerCase().indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, name);
  const firstDollar = source.indexOf("$$", start);
  return source.slice(start, source.indexOf("$$;", firstDollar + 2) + 3);
}

await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
  create function auth.role() returns text language sql as $$ select current_user::text $$;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create table players(id uuid primary key,display_name text);
  create table app_settings(key text primary key,value jsonb);
  create table matches(id bigserial primary key,external_id text unique,season text,round integer,
    home_team text,away_team text,match_time timestamptz,home_score integer,away_score integer,
    finished boolean default false,check(not finished or (home_score is not null and away_score is not null)));
  create table tips(id bigserial primary key,player_id uuid references players,match_id bigint references matches,
    home_tip integer,away_tip integer,points integer);
  create table ehl_standings(id bigserial primary key,season text,team text,position integer check(position between 1 and 10),
    played integer default 0,points integer default 0,unique(season,team),unique(season,position) deferrable initially deferred);
  create table fantasy_rounds(id uuid primary key default gen_random_uuid(),season text,round_no integer,deadline_at timestamptz);
  create table fantasy_games(id uuid primary key default gen_random_uuid(),external_id text unique,season text,
    home_team text,away_team text,home_score integer,away_score integer,status text,
    fantasy_round_id uuid references fantasy_rounds,fantasy_round_no integer,updated_at timestamptz);
  create table fantasy_round_games(round_id uuid references fantasy_rounds,game_id uuid references fantasy_games);
  create table fantasy_players(id uuid primary key default gen_random_uuid(),name text,team text,position text,
    active boolean default true,on_current_roster boolean default true,available_for_purchase boolean default true,
    updated_at timestamptz);
  create table fantasy_player_season_prices(player_id uuid references fantasy_players,season text,price numeric);
  create table fantasy_season_rules(season text,max_players_per_club integer);
  create table fantasy_user_teams(id uuid primary key default gen_random_uuid(),user_id uuid references players,
    season text,name text,budget numeric,updated_at timestamptz,unique(user_id,season));
  create table fantasy_user_team_players(id uuid primary key default gen_random_uuid(),team_id uuid references fantasy_user_teams,
    player_id uuid references fantasy_players,purchase_price numeric,is_captain boolean,is_vice_captain boolean,line_no integer);
  create table fantasy_team_round_snapshots(id uuid primary key default gen_random_uuid(),season text);
  insert into players values('${uid}','Synthetic one'),('${otherUid}','Synthetic two');
  insert into fantasy_season_rules values('2026/27',3);
  insert into fantasy_rounds(season,round_no,deadline_at) values('2026/27',1,now()+interval '2 days');
  insert into matches(external_id,season,home_team,away_team,match_time) values
    ('synthetic-sparta','2026/27','Sparta Elite','Narvik',now()+interval '2 days'),
    ('synthetic-active','2026/27','Storhamar','Oilers',now()+interval '2 days'),
    ('synthetic-history','2025/26','Sparta Elite','Narvik',now()-interval '1 year');
  insert into fantasy_games(external_id,season,home_team,away_team,status,fantasy_round_id,fantasy_round_no)
    select external_id,season,home_team,away_team,'scheduled',
    (select id from fantasy_rounds limit 1),1 from matches where season='2026/27';
  insert into fantasy_round_games select fantasy_round_id,id from fantasy_games;
  insert into fantasy_players(name,team,position) values('Synthetic Sparta player','Sparta','G');
  insert into fantasy_player_season_prices select id,'2026/27',5.5 from fantasy_players;
  insert into fantasy_user_teams(user_id,season,name,budget) values('${uid}','2026/27','Synthetic XI',100);
  insert into fantasy_user_team_players(team_id,player_id,purchase_price)
    select t.id,p.id,5.5 from fantasy_user_teams t cross join fantasy_players p;
  grant select on app_settings,ehl_standings,players,matches to authenticated;
`);
await db.exec(fs.readFileSync("supabase/v0.8-table-tips.sql", "utf8"));
await db.exec(existingFunction("supabase/mp13-table-tips-contract-v1.sql", "table_tips_is_locked"));
await db.exec(existingFunction("supabase/mp13-table-tips-contract-v1.sql", "guard_tip_deadline"));
await db.exec(existingFunction("supabase/v0.60-fantasy-line-scoring.sql", "save_fantasy_team_v3"));
await db.exec(`update app_settings set value=jsonb_build_object('season','2026/27','deadline',now()+interval '2 days') where key='table_tips'`);
for (let i = 0; i < teams.length; i++) {
  await db.query("insert into ehl_standings(season,team,position) values('2026/27',$1,$2)", [teams[i], i + 1]);
  await db.query("insert into table_tips(player_id,team,position) values($1,$2,$3),($4,$2,$5)", [uid, teams[i], i + 1, otherUid, 10 - i]);
}
await db.exec(`insert into tips(player_id,match_id,home_tip,away_tip) select '${uid}',id,3,1 from matches where external_id='synthetic-sparta'`);
await db.exec(`create trigger tips_deadline_guard before insert or update of player_id,match_id,home_tip,away_tip on tips for each row execute function guard_tip_deadline()`);

const ownershipBefore = await db.query("select * from fantasy_user_team_players order by id");
const pricesBefore = await db.query("select * from fantasy_player_season_prices order by player_id");
const deadlinesBefore = await db.query("select * from fantasy_rounds order by id");
const tipsBefore = await db.query("select * from tips order by id");
await db.exec("insert into fantasy_team_round_snapshots(season) values('2026/27')");
await assert.rejects(db.exec(migration), /Season has started/);
await db.exec("rollback; delete from fantasy_team_round_snapshots where season='2026/27';");
assert.equal((await one("select count(*)::int n from table_tips")).n, 20);
await db.exec(migration);

assert.deepEqual((await db.query("select team,position from table_tips where player_id=$1 order by position", [uid])).rows,
  active.map((team, i) => ({ team, position: i + 1 })));
assert.deepEqual((await db.query("select team,position from table_tips where player_id=$1 order by position", [otherUid])).rows,
  [...active].reverse().map((team, i) => ({ team, position: i + 1 })));
assert.equal((await one("select count(*)::int n from ehl_standings where active")).n, 9);
assert.equal((await one("select max(position) n from ehl_standings where active")).n, 9);
assert.equal((await one("select jsonb_array_length(before_rows) n from competition_adjustment_audit where scope='table_tips'")).n, 20);
assert.deepEqual((await db.query("select * from fantasy_user_team_players order by id")).rows, ownershipBefore.rows);
assert.deepEqual((await db.query("select * from fantasy_player_season_prices order by player_id")).rows, pricesBefore.rows);
assert.deepEqual((await db.query("select * from fantasy_rounds order by id")).rows, deadlinesBefore.rows);
assert.deepEqual((await db.query("select * from tips order by id")).rows, tipsBefore.rows);
assert.equal((await one("select cancelled from matches where external_id='synthetic-history'")).cancelled, false);
assert.equal((await one("select cancelled from matches where external_id='synthetic-sparta'")).cancelled, true);
assert.equal((await one("select count(*)::int n from fantasy_round_games")).n, 1);
assert.equal((await one("select fantasy_round_id from fantasy_games where external_id='synthetic-sparta'")).fantasy_round_id, null);
assert.equal((await one("select active from fantasy_players where team='Sparta'")).active, false);
const format = (await one("select value from app_settings where key='ehl_2026_27_format'")).value;
assert.equal(format.status, "pending"); assert.equal(format.games_per_team, null); assert.equal(format.total_games, null);

// Repeated migration cannot shift rankings again or overwrite original audit rows.
await db.exec(migration);
assert.equal((await one("select count(*)::int n from competition_adjustment_audit")).n, 8);
assert.equal((await one("select count(*)::int n from table_tips")).n, 18);

// Stale source data, including false scores and round links, cannot reactivate Sparta.
await db.exec(`update matches set cancelled=false,finished=true,home_score=4,away_score=2 where external_id='synthetic-sparta';
  update fantasy_games set status='finished',home_score=4,away_score=2,
    fantasy_round_id=(select id from fantasy_rounds limit 1),fantasy_round_no=1 where external_id='synthetic-sparta';
  update fantasy_players set active=true,on_current_roster=true,available_for_purchase=true where team='Sparta';
  update ehl_standings set active=true where team='Sparta';`);
assert.deepEqual(await one("select cancelled,finished,home_score,away_score from matches where external_id='synthetic-sparta'"),
  { cancelled: true, finished: false, home_score: null, away_score: null });
assert.deepEqual(await one("select status,fantasy_round_id,fantasy_round_no,home_score from fantasy_games where external_id='synthetic-sparta'"),
  { status: "cancelled", fantasy_round_id: null, fantasy_round_no: null, home_score: null });
assert.equal((await one("select available_for_purchase from fantasy_players where team='Sparta'")).available_for_purchase, false);
await assert.rejects(db.exec(`insert into fantasy_round_games select (select id from fantasy_rounds limit 1),id from fantasy_games where external_id='synthetic-sparta'`), /annulled game/);
await assert.rejects(db.exec(`insert into tips(player_id,match_id,home_tip,away_tip) select '${otherUid}',id,2,1 from matches where external_id='synthetic-sparta'`), /annullert/);

// Run the production cache algorithm: an annulled match between two hits must not break a streak.
const cacheSource = fs.readFileSync("supabase/mp01-scaling-competition-cache-v1.sql", "utf8");
await db.exec(cacheSource.slice(cacheSource.indexOf("create table if not exists public.tipping_leaderboard_cache"),
  cacheSource.indexOf("create table if not exists public.fantasy_season_leaderboard_cache")));
await db.exec(existingFunction("supabase/mp01-scaling-competition-cache-v1.sql", "refresh_tipping_leaderboard_cache_v1"));
await db.exec(`insert into matches(external_id,season,home_team,away_team,match_time,home_score,away_score,finished) values
 ('synthetic-hit-before','2026/27','Narvik','Oilers',now()+interval '1 day',3,1,true),
 ('synthetic-hit-after','2026/27','Narvik','Oilers',now()+interval '3 days',3,1,true);
 insert into tips(player_id,match_id,home_tip,away_tip,points)
 select '${uid}',id,3,1,5 from matches where external_id in ('synthetic-hit-before','synthetic-hit-after');
 select refresh_tipping_leaderboard_cache_v1();`);
assert.deepEqual(await one(`select points::int,scored_tips::int,streak,best_streak,hit_rate from tipping_leaderboard_cache where player_id='${uid}'`),
 {points:10,scored_tips:2,streak:2,best_streak:2,hit_rate:100});

// The real table-tip RPC, RLS and function grants run as authenticated, not as the owner.
await db.exec(`set test.uid='${uid}'; set role authenticated;`);
await assert.rejects(db.exec("select * from competition_adjustment_audit"), /permission denied/);
await assert.rejects(db.exec(`insert into table_tips(player_id,team,position) values('${uid}','Sparta',10)`), /permission denied/);
await assert.rejects(db.query("select save_table_tip_rankings($1::text[])", [teams]), /nøyaktig 9/);
await assert.rejects(db.query("select save_table_tip_rankings($1::text[])", [[...active.slice(1), active[1]]]), /én gang/);
await assert.rejects(db.query("select save_table_tip_rankings($1::text[])", [["Sparta", ...active.slice(1)]]), /ugyldige/);
await assert.rejects(db.query("select save_table_tip_rankings($1::text[])", [[null, ...active.slice(1)]]), /én gang/);
await db.query("select save_table_tip_rankings($1::text[])", [[...active].reverse()]);
assert.equal((await one(`select count(*)::int n from table_tips where player_id='${otherUid}'`)).n, 0);
await db.exec("reset role;");
await db.exec("update app_settings set value=jsonb_set(value,'{deadline}',to_jsonb((now()-interval '1 second')::text)) where key='table_tips'; set role authenticated;");
await assert.rejects(db.query("select save_table_tip_rankings($1::text[])", [active]), /låst/);
await db.exec("reset role; set test.uid=''; set role anon;");
await assert.rejects(db.query("select save_table_tip_rankings($1::text[])", [active]), /permission denied/);
await db.exec("reset role;");

// Existing preseason Fantasy save stays free, and rejects the inactive Sparta player.
const roster = [];
for (let i = 0; i < 12; i++) {
  const position = i < 2 ? "G" : i < 6 ? "D" : "W";
  const player = (await db.query("insert into fantasy_players(name,team,position) values($1,$2,$3) returning id",
    [`Synthetic replacement ${i}`, active[Math.floor(i / 3)], position])).rows[0];
  roster.push(player.id);
  await db.query("insert into fantasy_player_season_prices values($1,'2026/27',5)", [player.id]);
}
await db.exec(`set test.uid='${uid}';`);
await db.query("select save_fantasy_team_v3('2026/27','Synthetic XI',$1::uuid[],$2::uuid,$3::uuid)", [roster, roster[6], roster[7]]);
assert.equal((await one("select count(*)::int n from fantasy_user_team_players")).n, 12);
const spartaId = (await one("select id from fantasy_players where team='Sparta' limit 1")).id;
await assert.rejects(db.query("select save_fantasy_team_v3('2026/27','Synthetic XI',$1::uuid[],$2::uuid,$3::uuid)",
  [[spartaId, ...roster.slice(1)], roster[6], roster[7]]), /inactive/);

// A verified club change uses the same identity and price; no automatic substitution occurs.
await db.query("update fantasy_players set team='Narvik',active=true,on_current_roster=true,available_for_purchase=true where id=$1", [spartaId]);
assert.equal((await db.query("select available_for_purchase from fantasy_players where id=$1", [spartaId])).rows[0].available_for_purchase, true);
assert.equal((await db.query("select price from fantasy_player_season_prices where player_id=$1", [spartaId])).rows[0].price, "5.5");

// TS and SQL use identical, season-scoped alias rules (never Sparta Praha or an old season).
const source = fs.readFileSync("lib/ehl-season.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} }; new Function("exports", "module", compiled)(mod.exports, mod);
assert.equal(mod.exports.EHL_ACTIVE_TEAMS.length, 9);
for (const [season, team, expected] of [
  ["2026/27", " Sparta Elite ", true], ["2026/27", "Sparta Ishockey Elite, IL - Ishockey", true],
  ["2025/26", "Sparta", false], ["2027/28", "Sparta", false], ["2026/27", "Sparta Praha", false],
]) {
  assert.equal(mod.exports.isWithdrawnEhlTeam(season, team), expected);
  assert.equal((await db.query("select is_withdrawn_ehl_team($1,$2) result", [season, team])).rows[0].result, expected);
}
await db.close();
console.log("PASS: isolated PostgreSQL migration, preserved tips/ownership/prices/deadlines, nine-team RPC/RLS, stale sync guards, preseason Fantasy replacement and alias parity.");
