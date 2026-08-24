-- MP-12.3 / MP-12.7 – isolated behavioral E2E for personal Bonus Weeks and Event Week collision.
-- Synthetic season only; existing purchasable players/admin identity are referenced read-only.

create or replace function public.run_mp12_bonus_event_e2e_v1()
returns table(check_no integer,check_name text,passed boolean,detail text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_season constant text:='__e2e_mp12_bonus_event__';
  v_user uuid:='00000000-0000-4000-8000-000000001205'::uuid;
  v_admin uuid;
  v_team uuid; v_r_cap uuid; v_r_line uuid; v_r_cancel uuid; v_r_event uuid;
  v_g_cap uuid; v_g_line uuid; v_s_cap uuid; v_s_line uuid;
  v_f uuid[]; v_d uuid[]; v_g uuid[]; v_cap uuid; v_vice uuid; v_line2 uuid;
  v_activation record; v_cancel record; v_cap_row fantasy_team_round_player_points%rowtype;
  v_line_row fantasy_team_round_player_points%rowtype; v_cap_total fantasy_team_round_points%rowtype; v_line_total fantasy_team_round_points%rowtype;
  v_snapshot_cap fantasy_team_round_snapshots%rowtype; v_snapshot_line fantasy_team_round_snapshots%rowtype;
  v_collision_blocked boolean:=false; v_collision_error text:=''; v_second_booster_blocked boolean:=false; v_second_error text:='';
  v_old_sub text:=current_setting('request.jwt.claim.sub',true);
  v_old_role text:=current_setting('request.jwt.claim.role',true);
begin
  delete from fantasy_event_weeks where season=v_season;
  delete from fantasy_games where season=v_season;
  delete from fantasy_bonus_activations where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;

  select id into v_admin from players where coalesce(admin,false)=true order by id limit 1;
  if v_admin is null then raise exception 'Need one admin identity for isolated Event Week configuration'; end if;

  select array_agg(id order by id) into v_f from (
    select id from fantasy_players where active=true and on_current_roster=true and available_for_purchase=true and position in('C','W') order by id limit 6
  ) q;
  select array_agg(id order by id) into v_d from (
    select id from fantasy_players where active=true and on_current_roster=true and available_for_purchase=true and position='D' order by id limit 4
  ) q;
  select array_agg(id order by id) into v_g from (
    select id from fantasy_players where active=true and on_current_roster=true and available_for_purchase=true and position='G' order by id limit 2
  ) q;
  if coalesce(array_length(v_f,1),0)<>6 or coalesce(array_length(v_d,1),0)<>4 or coalesce(array_length(v_g,1),0)<>2 then
    raise exception 'Need 6F/4D/2G purchasable current-roster players';
  end if;
  v_cap:=v_f[1]; v_vice:=v_f[2]; v_line2:=v_f[4];

  insert into fantasy_user_teams(user_id,season,name,budget) values(v_user,v_season,'MP12 bonus E2E',100) returning id into v_team;
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain,line_no) values
    (v_team,v_f[1],5,true,false,1),(v_team,v_f[2],5,false,true,1),(v_team,v_f[3],5,false,false,1),
    (v_team,v_d[1],5,false,false,1),(v_team,v_d[2],5,false,false,1),(v_team,v_g[1],5,false,false,1),
    (v_team,v_f[4],5,false,false,2),(v_team,v_f[5],5,false,false,2),(v_team,v_f[6],5,false,false,2),
    (v_team,v_d[3],5,false,false,2),(v_team,v_d[4],5,false,false,2),(v_team,v_g[2],5,false,false,2);

  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status) values
    (v_season,1,'Captain Boost',now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours','open') returning id into v_r_cap;
  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status) values
    (v_season,2,'Line Boost',now()-interval '1 hour',now()+interval '2 hours',now()+interval '3 hours','open') returning id into v_r_line;
  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status) values
    (v_season,3,'Cancel Boost',now()-interval '1 hour',now()+interval '3 hours',now()+interval '4 hours','open') returning id into v_r_cancel;
  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status) values
    (v_season,4,'Event Week',now()-interval '1 hour',now()+interval '4 hours',now()+interval '5 hours','open') returning id into v_r_event;

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select * into v_activation from select_fantasy_booster_v1(v_season,'captain_boost',v_r_cap);
  begin
    perform * from select_fantasy_booster_v1(v_season,'line_boost',v_r_cap);
  exception when others then
    v_second_booster_blocked:=position('Another personal booster' in sqlerrm)>0;
    v_second_error:=sqlerrm;
  end;
  v_s_cap:=freeze_fantasy_team_for_round_internal(v_team,v_r_cap,now());
  select * into v_snapshot_cap from fantasy_team_round_snapshots where id=v_s_cap;

  insert into fantasy_games(external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id)
  values('__e2e_mp12_bonus__:cap',v_season,1,now()-interval '30 minutes','E2E','E2E','finished',v_r_cap) returning id into v_g_cap;
  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version) values
    (v_cap,v_g_cap,10,'mp12-bonus-e2e'),(v_line2,v_g_cap,8,'mp12-bonus-e2e');
  perform * from calculate_fantasy_round_team_points_internal(v_r_cap);
  select * into v_cap_row from fantasy_team_round_player_points where snapshot_id=v_s_cap and player_id=v_cap;
  select * into v_cap_total from fantasy_team_round_points where snapshot_id=v_s_cap;

  return query select 1,'Captain Boost commits at snapshot and applies x2.5'::text,
    v_snapshot_cap.booster_type='captain_boost' and v_snapshot_cap.captain_multiplier_override=2.50
    and (select status from fantasy_bonus_activations where team_id=v_team and booster_type='captain_boost')='committed'
    and v_cap_row.multiplier=2.50 and v_cap_row.total_points=25 and v_cap_total.total_points=29,
    format('booster=%s override=%s Cx=%s Ctotal=%s round=%s',v_snapshot_cap.booster_type,v_snapshot_cap.captain_multiplier_override,v_cap_row.multiplier,v_cap_row.total_points,v_cap_total.total_points);

  return query select 2,'Only one personal booster can occupy a round'::text,
    v_second_booster_blocked,
    coalesce(v_second_error,'no error');

  select * into v_activation from select_fantasy_booster_v1(v_season,'line_boost',v_r_line);
  v_s_line:=freeze_fantasy_team_for_round_internal(v_team,v_r_line,now());
  select * into v_snapshot_line from fantasy_team_round_snapshots where id=v_s_line;
  insert into fantasy_games(external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id)
  values('__e2e_mp12_bonus__:line',v_season,2,now()-interval '20 minutes','E2E','E2E','finished',v_r_line) returning id into v_g_line;
  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version) values
    (v_cap,v_g_line,10,'mp12-bonus-e2e'),(v_line2,v_g_line,8,'mp12-bonus-e2e');
  perform * from calculate_fantasy_round_team_points_internal(v_r_line);
  select * into v_line_row from fantasy_team_round_player_points where snapshot_id=v_s_line and player_id=v_line2;
  select * into v_line_total from fantasy_team_round_points where snapshot_id=v_s_line;

  return query select 3,'Line Boost commits at snapshot and makes line 2 x1.0'::text,
    v_snapshot_line.booster_type='line_boost' and v_snapshot_line.line2_multiplier_override=1.00
    and (select status from fantasy_bonus_activations where team_id=v_team and booster_type='line_boost')='committed'
    and v_line_row.line_multiplier=1.00 and v_line_row.total_points=8 and v_line_total.total_points=28,
    format('booster=%s override=%s line2=%s Ptotal=%s round=%s',v_snapshot_line.booster_type,v_snapshot_line.line2_multiplier_override,v_line_row.line_multiplier,v_line_row.total_points,v_line_total.total_points);

  select * into v_activation from select_fantasy_booster_v1(v_season,'transfer_boost',v_r_cancel);
  select * into v_cancel from cancel_fantasy_booster_v1(v_season,'transfer_boost');
  return query select 4,'Uncommitted transfer boost can be cancelled before deadline'::text,
    v_cancel.status='cancelled' and (select status from fantasy_bonus_activations where team_id=v_team and booster_type='transfer_boost')='cancelled',
    format('status=%s',v_cancel.status);

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform * from configure_fantasy_event_week_v1(v_season,'rich_uncle',v_r_event,true);

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  begin
    perform * from select_fantasy_booster_v1(v_season,'captain_boost',v_r_event);
  exception when others then
    v_collision_blocked:=position('Event Week' in sqlerrm)>0;
    v_collision_error:=sqlerrm;
  end;
  return query select 5,'Event Week blocks personal booster selection'::text,
    v_collision_blocked,
    coalesce(v_collision_error,'no error');

  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
  delete from fantasy_event_weeks where season=v_season;
  delete from fantasy_games where season=v_season;
  delete from fantasy_bonus_activations where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  return query select 6,'Synthetic Bonus/Event fixtures cleaned'::text,
    not exists(select 1 from fantasy_event_weeks where season=v_season)
    and not exists(select 1 from fantasy_games where season=v_season)
    and not exists(select 1 from fantasy_bonus_activations where season=v_season)
    and not exists(select 1 from fantasy_user_teams where season=v_season)
    and not exists(select 1 from fantasy_rounds where season=v_season),
    'cleanup complete'::text;
exception when others then
  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
  delete from fantasy_event_weeks where season=v_season;
  delete from fantasy_games where season=v_season;
  delete from fantasy_bonus_activations where season=v_season;
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  raise;
end;
$$;

revoke all on function public.run_mp12_bonus_event_e2e_v1() from public,anon,authenticated;
grant execute on function public.run_mp12_bonus_event_e2e_v1() to service_role;
