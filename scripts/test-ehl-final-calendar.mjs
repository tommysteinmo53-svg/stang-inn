// Isolated PostgreSQL only; synthetic fixtures, no production connection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const migration=fs.readFileSync('supabase/migrations/20260916053819_confirm_ehl_40_game_calendar_2026_27.sql','utf8');
await db.exec(`create table matches(id serial primary key,external_id text,season text,home_team text,away_team text,match_time timestamptz,cancelled boolean default false,finished boolean default false);
create table fantasy_rounds(id int primary key,season text,round_no int,status text,starts_at timestamptz,ends_at timestamptz,deadline_at timestamptz,updated_at timestamptz);
create table fantasy_games(id serial primary key,external_id text,season text,home_team text,away_team text,starts_at timestamptz,status text,fantasy_round_id int,fantasy_round_no int);
create table fantasy_team_round_snapshots(season text);
create table fantasy_event_weeks(season text,round_id int,event_type text,is_published boolean);
create table app_settings(key text primary key,value jsonb);
create table competition_adjustment_audit(adjustment text,scope text,before_rows jsonb,primary key(adjustment,scope));
create function is_withdrawn_ehl_team(text,text) returns boolean language sql as $$ select $1='2026/27' and $2='Sparta' $$;
insert into app_settings values('ehl_2026_27_format','{"status":"pending","calendar_provisional":true}');`);
const base=Date.now()+14*86400000;
let order=[0,1,2,3,4,5,6,7,8,9];
for(let cycle=0;cycle<5;cycle++)for(let step=0;step<9;step++){
 const round=cycle*9+step+1, start=new Date(base+round*86400000), deadline=new Date(+start-([1,9,31,37].includes(round)?1800000:0));
 await db.query("insert into fantasy_rounds values($1,'2026/27',$1,'open',$2,$3,$2,null)",[round,deadline,new Date(+start+21600000)]);
 for(let i=0;i<5;i++){
  const a=order[i],b=order[9-i];if(a===9||b===9)continue;
  const eid=`synthetic:${round}:${i}`,h=`Club ${a}`,v=`Club ${b}`;
  await db.query("insert into matches(external_id,season,home_team,away_team,match_time) values($1,'2026/27',$2,$3,$4)",[eid,h,v,start]);
  await db.query("insert into fantasy_games(external_id,season,home_team,away_team,starts_at,status,fantasy_round_id,fantasy_round_no) values($1,'2026/27',$2,$3,$4,'scheduled',$5,$5)",[eid,h,v,start,round]);
 }
 order=[order[0],order[9],...order.slice(1,9)];
}
await db.exec(`insert into app_settings select 'table_tips',jsonb_build_object('season','2026/27','team_count',9,'deadline',min(deadline_at)) from fantasy_rounds;
insert into fantasy_event_weeks values('2026/27',15,'rich_uncle',true),('2026/27',22,'christmas_party',true),('2026/27',38,'poor_uncle',true);`);
const rows=async sql=>(await db.query(sql)).rows;
const before=await rows('select * from fantasy_rounds order by id');
const games=await rows('select * from fantasy_games order by id');
const matches=await rows('select * from matches order by id');
const events=await rows('select * from fantasy_event_weeks order by round_id');
await db.exec("insert into fantasy_team_round_snapshots values('2026/27')");
await assert.rejects(db.exec(migration),/no snapshots/);await db.exec('rollback;delete from fantasy_team_round_snapshots');
await db.exec('update matches set cancelled=true where id=1');
await assert.rejects(db.exec(migration),/180 valid/);await db.exec('rollback;update matches set cancelled=false where id=1');
await db.exec(migration);
const after=await rows('select * from fantasy_rounds order by id');
assert.deepEqual(after.filter((r,i)=>+new Date(r.deadline_at)!==+new Date(before[i].deadline_at)).map(r=>r.round_no),[1,9,31,37]);
assert.equal((await rows(`select count(*)::int n from fantasy_rounds r where deadline_at<>(select min(starts_at) from fantasy_games where fantasy_round_id=r.id)`))[0].n,0);
assert.deepEqual(after.map(({starts_at,deadline_at,updated_at,...r})=>r),before.map(({starts_at,deadline_at,updated_at,...r})=>r));
assert.deepEqual(await rows('select * from fantasy_games order by id'),games);
assert.deepEqual(await rows('select * from matches order by id'),matches);
assert.deepEqual(await rows('select * from fantasy_event_weeks order by round_id'),events);
const format=(await rows("select value from app_settings where key='ehl_2026_27_format'"))[0].value;
assert.equal(format.status,'confirmed');assert.equal(format.games_per_team,40);assert.equal(format.fantasy_rounds,45);assert.equal(format.calendar_provisional,false);
assert.equal(Date.parse((await rows("select value->>'deadline' deadline from app_settings where key='table_tips'"))[0].deadline),+new Date(after[0].deadline_at));
await db.exec(migration);assert.deepEqual(await rows('select * from fantasy_rounds order by id'),after);
assert.equal((await rows('select count(*)::int n from competition_adjustment_audit'))[0].n,4);
await db.close();console.log('PASS: 40-game calendar, protected snapshots, incomplete feed rejection, four aligned deadlines, preserved fixtures/events and idempotency.');
