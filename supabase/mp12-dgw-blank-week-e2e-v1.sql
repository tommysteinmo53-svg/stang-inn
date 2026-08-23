-- MP-12.3 / MP-12.7 – isolated behavioral E2E for double gameweeks and blank-team players.
-- Synthetic season only; existing fantasy players are referenced read-only.

create or replace function public.run_mp12_dgw_blank_week_e2e_v1()
returns table(check_no integer,check_name text,passed boolean,detail text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_season constant text:='__e2e_mp12_dgw_blank__';
  v_user uuid:='00000000-0000-4000-8000-000000001203'::uuid;
  v_team uuid; v_round uuid; v_g1 uuid; v_g2 uuid; v_snapshot uuid;
  v_dgw fantasy_players%rowtype; v_blank fantasy_players%rowtype; v_other fantasy_players%rowtype;
  v_dgw_row fantasy_team_round_player_points%rowtype; v_blank_row fantasy_team_round_player_points%rowtype; v_result fantasy_team_round_points%rowtype;
begin
  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;

  select * into v_dgw from fantasy_players where active=true order by id limit 1;
  select * into v_blank from fantasy_players where active=true and id<>v_dgw.id order by id limit 1;
  select * into v_other from fantasy_players where active=true and id not in(v_dgw.id,v_blank.id) order by id limit 1;
  if v_other.id is null then raise exception 'Need at least three active fantasy players'; end if;

  insert into fantasy_user_teams(user_id,season,name,budget) values(v_user,v_season,'MP12 DGW/BGW E2E',100) returning id into v_team;
  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status)
  values(v_season,1,'MP12 DGW/BGW',now()-interval '3 hours',now()-interval '4 hours',now()-interval '1 hour','finished') returning id into v_round;

  insert into fantasy_games(external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id) values
    ('__e2e_mp12_dgw_blank__:1',v_season,1,now()-interval '3 hours','DGW HOME','DGW AWAY','finished',v_round) returning id into v_g1;
  insert into fantasy_games(external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id) values
    ('__e2e_mp12_dgw_blank__:2',v_season,1,now()-interval '2 hours','DGW HOME','DGW OTHER','finished',v_round) returning id into v_g2;

  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value)
  values(v_round,v_team,v_user,v_season,'MP12 DGW/BGW E2E',15) returning id into v_snapshot;
  insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no,player_name) values
    (v_snapshot,v_dgw.id,v_dgw.position,v_dgw.team,5,false,false,1,v_dgw.name),
    (v_snapshot,v_blank.id,v_blank.position,v_blank.team,5,false,false,1,v_blank.name),
    (v_snapshot,v_other.id,v_other.position,v_other.team,5,false,false,2,v_other.name);

  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version) values
    (v_dgw.id,v_g1,4,'mp12-dgw-e2e'),(v_dgw.id,v_g2,6,'mp12-dgw-e2e'),
    (v_other.id,v_g1,8,'mp12-dgw-e2e');

  perform * from calculate_fantasy_round_team_points_internal(v_round);
  select * into v_dgw_row from fantasy_team_round_player_points where snapshot_id=v_snapshot and player_id=v_dgw.id;
  select * into v_blank_row from fantasy_team_round_player_points where snapshot_id=v_snapshot and player_id=v_blank.id;
  select * into v_result from fantasy_team_round_points where snapshot_id=v_snapshot;

  return query select 1,'DGW player aggregates both games'::text,
    v_dgw_row.games_played=2 and v_dgw_row.raw_points=10 and v_dgw_row.total_points=10,
    format('games=%s raw=%s total=%s',v_dgw_row.games_played,v_dgw_row.raw_points,v_dgw_row.total_points);
  return query select 2,'Blank-week player gets zero games and zero points'::text,
    not v_blank_row.played and v_blank_row.games_played=0 and v_blank_row.raw_points=0 and v_blank_row.total_points=0,
    format('played=%s games=%s raw=%s total=%s',v_blank_row.played,v_blank_row.games_played,v_blank_row.raw_points,v_blank_row.total_points);
  return query select 3,'Round total includes DGW sum and line multiplier once per player aggregate'::text,
    v_result.base_points=14 and v_result.total_points=14,
    format('base=%s total=%s',v_result.base_points,v_result.total_points);

  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  return query select 4,'Synthetic DGW/BGW fixtures cleaned'::text,
    not exists(select 1 from fantasy_games where season=v_season)
    and not exists(select 1 from fantasy_user_teams where season=v_season)
    and not exists(select 1 from fantasy_rounds where season=v_season)
    and not exists(select 1 from fantasy_team_round_snapshots where season=v_season),
    'cleanup complete'::text;
exception when others then
  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  raise;
end;
$$;

revoke all on function public.run_mp12_dgw_blank_week_e2e_v1() from public,anon,authenticated;
grant execute on function public.run_mp12_dgw_blank_week_e2e_v1() to service_role;
