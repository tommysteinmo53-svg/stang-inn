-- MP-12.3 / MP-12.7 – isolated behavioral E2E for the round automation lifecycle.
-- Uses a fully synthetic season/team/round/game and only read-only references to purchasable players.

create or replace function public.run_mp12_round_automation_e2e_v2()
returns table(check_no integer,check_name text,passed boolean,detail text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_season constant text:='__e2e_mp12_round_automation__';
  v_user uuid:='00000000-0000-4000-8000-000000001204'::uuid;
  v_team uuid; v_round uuid; v_game uuid; v_snapshot uuid;
  v_f uuid[]; v_d uuid[]; v_g uuid[]; v_cap uuid; v_vice uuid; v_other uuid;
  v_run record; v_total numeric; v_score_time timestamptz;
  v_old_sub text:=current_setting('request.jwt.claim.sub',true);
  v_old_role text:=current_setting('request.jwt.claim.role',true);
  v_prod_rounds_before bigint; v_prod_games_before bigint; v_prod_scores_before bigint;
  v_prod_rounds_after bigint; v_prod_games_after bigint; v_prod_scores_after bigint;
begin
  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;

  select count(*) into v_prod_rounds_before from fantasy_rounds where season='2026/27';
  select count(*) into v_prod_games_before from fantasy_games where season='2026/27';
  select count(*) into v_prod_scores_before from fantasy_team_round_points where season='2026/27';

  select array_agg(id order by id) into v_f from (
    select id from fantasy_players
    where active=true and on_current_roster=true and available_for_purchase=true and position in('C','W')
    order by id limit 6
  ) q;
  select array_agg(id order by id) into v_d from (
    select id from fantasy_players
    where active=true and on_current_roster=true and available_for_purchase=true and position='D'
    order by id limit 4
  ) q;
  select array_agg(id order by id) into v_g from (
    select id from fantasy_players
    where active=true and on_current_roster=true and available_for_purchase=true and position='G'
    order by id limit 2
  ) q;
  if coalesce(array_length(v_f,1),0)<>6 or coalesce(array_length(v_d,1),0)<>4 or coalesce(array_length(v_g,1),0)<>2 then
    raise exception 'Need 6F/4D/2G purchasable current-roster players';
  end if;
  v_cap:=v_f[1]; v_vice:=v_f[2]; v_other:=v_f[3];

  insert into fantasy_user_teams(user_id,season,name,budget)
  values(v_user,v_season,'MP12 automation E2E',100) returning id into v_team;
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain,line_no) values
    (v_team,v_f[1],5,true,false,1),(v_team,v_f[2],5,false,true,1),(v_team,v_f[3],5,false,false,1),
    (v_team,v_d[1],5,false,false,1),(v_team,v_d[2],5,false,false,1),(v_team,v_g[1],5,false,false,1),
    (v_team,v_f[4],5,false,false,2),(v_team,v_f[5],5,false,false,2),(v_team,v_f[6],5,false,false,2),
    (v_team,v_d[3],5,false,false,2),(v_team,v_d[4],5,false,false,2),(v_team,v_g[2],5,false,false,2);

  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status)
  values(v_season,1,'MP12 automation E2E',now()-interval '2 hours',now()-interval '3 hours',now()+interval '1 hour','locked')
  returning id into v_round;
  insert into fantasy_games(external_id,season,round_no,fantasy_round_no,starts_at,home_team,away_team,status,fantasy_round_id)
  values('__e2e_mp12_round_automation__:1',v_season,1,1,now()-interval '2 hours','E2E HOME','E2E AWAY','scheduled',v_round)
  returning id into v_game;

  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claim.role','service_role',true);

  select * into v_run from process_fantasy_rounds_automation(v_season,true);
  select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round and team_id=v_team;
  return query select 1,'Deadline freezes team but unfinished game does not score'::text,
    v_snapshot is not null and v_run.snapshots_created=1 and v_run.scored_rounds=0 and v_run.skipped_unfinished=1 and v_run.snapshot_errors=0,
    format('snapshot=%s created=%s scored=%s unfinished=%s errors=%s',v_snapshot,v_run.snapshots_created,v_run.scored_rounds,v_run.skipped_unfinished,v_run.snapshot_errors);

  update fantasy_games set status='finished',home_score=2,away_score=1,updated_at=now() where id=v_game;
  insert into fantasy_player_game_stats(player_id,game_id,did_play,position_snapshot,team_snapshot,raw)
  select v_cap,v_game,true,fp.position,fp.team,'{"test":"mp12","role":"captain"}'::jsonb from fantasy_players fp where fp.id=v_cap
  union all select v_vice,v_game,true,fp.position,fp.team,'{"test":"mp12","role":"vice"}'::jsonb from fantasy_players fp where fp.id=v_vice
  union all select v_other,v_game,true,fp.position,fp.team,'{"test":"mp12","role":"other"}'::jsonb from fantasy_players fp where fp.id=v_other;
  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version,breakdown)
  values(v_cap,v_game,10,'mp12-automation','{"test":true}'::jsonb),(v_vice,v_game,7,'mp12-automation','{"test":true}'::jsonb);

  select * into v_run from process_fantasy_rounds_automation(v_season,true);
  return query select 2,'Partial player-point materialization blocks round scoring'::text,
    v_run.scored_rounds=0 and v_run.skipped_points_not_ready=1 and not exists(select 1 from fantasy_team_round_points where round_id=v_round),
    format('scored=%s points_not_ready=%s score_rows=%s',v_run.scored_rounds,v_run.skipped_points_not_ready,(select count(*) from fantasy_team_round_points where round_id=v_round));

  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version,breakdown)
  values(v_other,v_game,3,'mp12-automation','{"test":true}'::jsonb);
  select * into v_run from process_fantasy_rounds_automation(v_season,true);
  select total_points,calculated_at into v_total,v_score_time from fantasy_team_round_points where round_id=v_round and team_id=v_team;
  return query select 3,'Complete points score the round through production automation'::text,
    v_run.ready_rounds=1 and v_run.scored_rounds=1 and v_run.scored_snapshots=1 and v_total=33.50,
    format('ready=%s scored=%s snapshots=%s total=%s',v_run.ready_rounds,v_run.scored_rounds,v_run.scored_snapshots,v_total);

  select * into v_run from process_fantasy_rounds_automation(v_season,true);
  return query select 4,'Automation rerun is idempotent without newer player points'::text,
    v_run.scored_rounds=0 and (select calculated_at from fantasy_team_round_points where round_id=v_round and team_id=v_team)=v_score_time,
    format('rescored=%s timestamp_unchanged=%s',v_run.scored_rounds,((select calculated_at from fantasy_team_round_points where round_id=v_round and team_id=v_team)=v_score_time));

  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;

  select count(*) into v_prod_rounds_after from fantasy_rounds where season='2026/27';
  select count(*) into v_prod_games_after from fantasy_games where season='2026/27';
  select count(*) into v_prod_scores_after from fantasy_team_round_points where season='2026/27';
  return query select 5,'Synthetic automation fixtures cleaned and production counts unchanged'::text,
    not exists(select 1 from fantasy_games where season=v_season)
    and not exists(select 1 from fantasy_user_teams where season=v_season)
    and not exists(select 1 from fantasy_rounds where season=v_season)
    and v_prod_rounds_before=v_prod_rounds_after and v_prod_games_before=v_prod_games_after and v_prod_scores_before=v_prod_scores_after,
    format('prod rounds %s→%s games %s→%s scores %s→%s',v_prod_rounds_before,v_prod_rounds_after,v_prod_games_before,v_prod_games_after,v_prod_scores_before,v_prod_scores_after);
exception when others then
  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
  delete from fantasy_games where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  raise;
end;
$$;

revoke all on function public.run_mp12_round_automation_e2e_v2() from public,anon,authenticated;
grant execute on function public.run_mp12_round_automation_e2e_v2() to service_role;
