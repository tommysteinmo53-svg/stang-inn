-- MP-12.3 / MP-12.7 – restore the schema contract consumed by calculate_fantasy_round_team_points_internal.
-- These views are internal-only compatibility layers over the current authoritative tables.

create or replace view public.fantasy_round_games
with (security_invoker=true)
as
select g.fantasy_round_id as round_id,g.id as game_id
from public.fantasy_games g
where g.fantasy_round_id is not null;

create or replace view public.fantasy_game_player_points
with (security_invoker=true)
as
select distinct on (p.player_id,p.game_id)
  p.id,p.player_id,p.game_id,p.actual_points as total_points
from public.fantasy_player_points p
order by p.player_id,p.game_id,p.calculated_at desc,p.id desc;

revoke all on public.fantasy_round_games from public,anon,authenticated,service_role;
revoke all on public.fantasy_game_player_points from public,anon,authenticated,service_role;

create or replace function public.run_mp12_team_scoring_e2e_v1()
returns table(check_no integer,check_name text,passed boolean,detail text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_season constant text:='__e2e_mp12_team_scoring__';
  v_user uuid:='00000000-0000-4000-8000-000000001201'::uuid;
  v_team uuid; v_r1 uuid; v_r2 uuid; v_g1 uuid; v_g2 uuid; v_s1 uuid; v_s2 uuid;
  v_cap fantasy_players%rowtype; v_vice fantasy_players%rowtype; v_other fantasy_players%rowtype;
  v_a fantasy_team_round_points%rowtype; v_b fantasy_team_round_points%rowtype;
  v_cap_a fantasy_team_round_player_points%rowtype; v_vice_a fantasy_team_round_player_points%rowtype; v_vice_b fantasy_team_round_player_points%rowtype; v_other_a fantasy_team_round_player_points%rowtype;
begin
  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;

  select * into v_cap from fantasy_players where active=true order by id limit 1;
  select * into v_vice from fantasy_players where active=true and id<>v_cap.id order by id limit 1;
  select * into v_other from fantasy_players where active=true and id not in(v_cap.id,v_vice.id) order by id limit 1;
  if v_other.id is null then raise exception 'Need at least three active fantasy players'; end if;

  insert into fantasy_user_teams(user_id,season,name,budget) values(v_user,v_season,'MP12 scoring E2E',100) returning id into v_team;
  insert into fantasy_rounds(season,round_no,name,deadline_at,status) values(v_season,1,'E2E A',now()-interval '1 hour','finished') returning id into v_r1;
  insert into fantasy_rounds(season,round_no,name,deadline_at,status) values(v_season,2,'E2E B',now()-interval '1 hour','finished') returning id into v_r2;
  insert into fantasy_games(external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id) values('__e2e_mp12_team_scoring__:A',v_season,1,now()-interval '2 hours','E2E H','E2E A','finished',v_r1) returning id into v_g1;
  insert into fantasy_games(external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id) values('__e2e_mp12_team_scoring__:B',v_season,2,now()-interval '2 hours','E2E H','E2E A','finished',v_r2) returning id into v_g2;

  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value) values(v_r1,v_team,v_user,v_season,'MP12 scoring E2E',15) returning id into v_s1;
  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value) values(v_r2,v_team,v_user,v_season,'MP12 scoring E2E',15) returning id into v_s2;

  insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no,player_name) values
    (v_s1,v_cap.id,v_cap.position,v_cap.team,5,true,false,1,v_cap.name),(v_s1,v_vice.id,v_vice.position,v_vice.team,5,false,true,1,v_vice.name),(v_s1,v_other.id,v_other.position,v_other.team,5,false,false,2,v_other.name),
    (v_s2,v_cap.id,v_cap.position,v_cap.team,5,true,false,1,v_cap.name),(v_s2,v_vice.id,v_vice.position,v_vice.team,5,false,true,1,v_vice.name),(v_s2,v_other.id,v_other.position,v_other.team,5,false,false,2,v_other.name);

  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version) values
    (v_cap.id,v_g1,10,'mp12-e2e'),(v_vice.id,v_g1,8,'mp12-e2e'),(v_other.id,v_g1,6,'mp12-e2e'),
    (v_vice.id,v_g2,8,'mp12-e2e'),(v_other.id,v_g2,6,'mp12-e2e');

  perform * from calculate_fantasy_round_team_points_internal(v_r1);
  perform * from calculate_fantasy_round_team_points_internal(v_r2);

  select * into v_a from fantasy_team_round_points where snapshot_id=v_s1;
  select * into v_b from fantasy_team_round_points where snapshot_id=v_s2;
  select * into v_cap_a from fantasy_team_round_player_points where snapshot_id=v_s1 and player_id=v_cap.id;
  select * into v_vice_a from fantasy_team_round_player_points where snapshot_id=v_s1 and player_id=v_vice.id;
  select * into v_vice_b from fantasy_team_round_player_points where snapshot_id=v_s2 and player_id=v_vice.id;
  select * into v_other_a from fantasy_team_round_player_points where snapshot_id=v_s1 and player_id=v_other.id;

  return query select 1,'Captain x2 and vice x1.5'::text,
    v_cap_a.multiplier=2 and v_cap_a.total_points=20 and v_vice_a.multiplier=1.5 and v_vice_a.total_points=12,
    format('C=%s/%s VC=%s/%s',v_cap_a.multiplier,v_cap_a.total_points,v_vice_a.multiplier,v_vice_a.total_points);
  return query select 2,'Line 2 remains x0.5'::text,v_other_a.line_multiplier=.5 and v_other_a.total_points=3,format('line=%s total=%s',v_other_a.line_multiplier,v_other_a.total_points);
  return query select 3,'Round A total is correct'::text,v_a.base_points=21 and v_a.captain_bonus=10 and v_a.vice_captain_bonus=4 and v_a.total_points=35,format('base=%s C=%s VC=%s total=%s',v_a.base_points,v_a.captain_bonus,v_a.vice_captain_bonus,v_a.total_points);
  return query select 4,'Vice remains x1.5 when captain does not play'::text,v_vice_b.played and v_vice_b.multiplier=1.5 and v_vice_b.total_points=12 and v_b.base_points=11 and v_b.captain_bonus=0 and v_b.vice_captain_bonus=4 and v_b.total_points=15,format('VC=%s total=%s round=%s',v_vice_b.multiplier,v_vice_b.total_points,v_b.total_points);

  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  return query select 5,'Synthetic season cleaned'::text,not exists(select 1 from fantasy_rounds where season=v_season) and not exists(select 1 from fantasy_games where season=v_season) and not exists(select 1 from fantasy_user_teams where season=v_season),'cleanup complete'::text;
exception when others then
  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  raise;
end;
$$;

revoke all on function public.run_mp12_team_scoring_e2e_v1() from public,anon,authenticated;
grant execute on function public.run_mp12_team_scoring_e2e_v1() to service_role;
