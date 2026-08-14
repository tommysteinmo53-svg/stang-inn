-- Stang Inn Fantasy Hockey – v0.29.1
-- Isolated E2E test for get_my_fantasy_round_details_v1.
-- Creates only a synthetic test season/team/round/result and references one existing
-- fantasy player without modifying that player. Everything created is removed before return.

create or replace function run_fantasy_my_round_details_e2e_test()
returns table(
  check_no integer,
  check_name text,
  passed boolean,
  detail text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_test_season text := '__e2e_my_round_details__';
  v_user uuid := '00000000-0000-4000-8000-000000002901'::uuid;
  v_other_user uuid := '00000000-0000-4000-8000-000000002902'::uuid;
  v_team uuid;
  v_round uuid;
  v_snapshot uuid;
  v_team_points uuid;
  v_player fantasy_players%rowtype;
  v_rows record;
  v_other_count integer := 0;
  v_real_rounds_before integer;
  v_real_rounds_after integer;
  v_real_games_before integer;
  v_real_games_after integer;
  v_real_teams_before integer;
  v_real_teams_after integer;
  v_old_sub text;
  v_old_role text;
begin
  select count(*) into v_real_rounds_before
  from fantasy_rounds where season='2026/27' and round_no<9000;
  select count(*) into v_real_games_before
  from fantasy_games where season='2026/27';
  select count(*) into v_real_teams_before
  from fantasy_user_teams where season='2026/27';

  -- Defensive cleanup in case a previous interrupted run left fixtures behind.
  delete from fantasy_user_teams where season=v_test_season;
  delete from fantasy_rounds where season=v_test_season;

  select * into v_player
  from fantasy_players
  where active=true
  order by id
  limit 1;

  if not found then
    raise exception 'E2E requires at least one existing active fantasy player';
  end if;

  insert into fantasy_user_teams(user_id,season,name,budget)
  values(v_user,v_test_season,'__e2e_my_round_details__',100)
  returning id into v_team;

  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status)
  values(v_test_season,8997,'E2E rundedetalj',now()-interval '2 hours',now()-interval '90 minutes',now()-interval '1 hour','finished')
  returning id into v_round;

  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value,captured_at)
  values(v_round,v_team,v_user,v_test_season,'__e2e_my_round_details__',5,now()-interval '90 minutes')
  returning id into v_snapshot;

  insert into fantasy_team_round_points(
    snapshot_id,round_id,team_id,user_id,season,
    base_points,captain_bonus,vice_captain_bonus,total_points,
    calculation_version,calculated_at
  ) values(
    v_snapshot,v_round,v_team,v_user,v_test_season,
    10,10,0,20,'e2e-v1',now()
  ) returning id into v_team_points;

  insert into fantasy_team_round_player_points(
    team_round_points_id,snapshot_id,round_id,team_id,
    player_id,player_name,position,team,
    is_captain,is_vice_captain,played,games_played,
    raw_points,multiplier,bonus_points,total_points,calculated_at
  ) values(
    v_team_points,v_snapshot,v_round,v_team,
    v_player.id,v_player.name,v_player.position,v_player.team,
    true,false,true,1,
    10,2,10,20,now()
  );

  v_old_sub := current_setting('request.jwt.claim.sub',true);
  v_old_role := current_setting('request.jwt.claim.role',true);
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select * into v_rows
  from get_my_fantasy_round_details_v1(v_test_season,v_round)
  limit 1;

  return query
  select 1,'Egen rundedetalj returneres'::text,
    v_rows.round_id=v_round and v_rows.team_id=v_team and v_rows.player_id=v_player.id,
    format('round=%s team=%s player=%s',v_rows.round_no,v_rows.team_name,v_rows.player_name);

  return query
  select 2,'Lag- og spillerpoeng stemmer'::text,
    v_rows.base_points=10 and v_rows.captain_bonus=10 and v_rows.round_points=20
      and v_rows.raw_points=10 and v_rows.multiplier=2 and v_rows.bonus_points=10
      and v_rows.player_total_points=20,
    format('base=%s C=%s total=%s player=%s x%s +%s',v_rows.base_points,v_rows.captain_bonus,v_rows.round_points,v_rows.raw_points,v_rows.multiplier,v_rows.bonus_points);

  return query
  select 3,'Kaptein og kampstatus returneres'::text,
    v_rows.is_captain=true and v_rows.is_vice_captain=false and v_rows.played=true and v_rows.games_played=1,
    format('captain=%s vice=%s played=%s games=%s',v_rows.is_captain,v_rows.is_vice_captain,v_rows.played,v_rows.games_played);

  perform set_config('request.jwt.claim.sub',v_other_user::text,true);
  select count(*)::integer into v_other_count
  from get_my_fantasy_round_details_v1(v_test_season,v_round);

  return query
  select 4,'Andre brukere får ikke se laget'::text,
    v_other_count=0,
    format('rows_for_other_user=%s',v_other_count);

  -- Restore caller claims before cleanup/return.
  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);

  delete from fantasy_user_teams where id=v_team;
  delete from fantasy_rounds where id=v_round;

  select count(*) into v_real_rounds_after
  from fantasy_rounds where season='2026/27' and round_no<9000;
  select count(*) into v_real_games_after
  from fantasy_games where season='2026/27';
  select count(*) into v_real_teams_after
  from fantasy_user_teams where season='2026/27';

  return query
  select 5,'Ekte 2026/27-data er urørt og testen er ryddet'::text,
    v_real_rounds_before=v_real_rounds_after
      and v_real_games_before=v_real_games_after
      and v_real_teams_before=v_real_teams_after
      and not exists(select 1 from fantasy_rounds where season=v_test_season)
      and not exists(select 1 from fantasy_user_teams where season=v_test_season),
    format('rounds %s→%s, games %s→%s, teams %s→%s',v_real_rounds_before,v_real_rounds_after,v_real_games_before,v_real_games_after,v_real_teams_before,v_real_teams_after);

exception when others then
  -- Best-effort cleanup, then surface the original failure.
  begin
    perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
    perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
    delete from fantasy_user_teams where season=v_test_season;
    delete from fantasy_rounds where season=v_test_season;
  exception when others then null;
  end;
  raise;
end;
$$;

revoke all on function run_fantasy_my_round_details_e2e_test() from public;
grant execute on function run_fantasy_my_round_details_e2e_test() to service_role;
