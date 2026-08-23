-- MP-12.3 / MP-12.7 – isolated behavioral E2E for snapshot/freeze.
-- Uses only a synthetic season/team/round and read-only references to existing players.

create or replace function public.run_mp12_snapshot_freeze_e2e_v1()
returns table(check_no integer,check_name text,passed boolean,detail text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_season constant text:='__e2e_mp12_snapshot__';
  v_user uuid:='00000000-0000-4000-8000-000000001202'::uuid;
  v_team uuid; v_round uuid; v_snapshot uuid; v_snapshot_again uuid;
  v_f uuid[]; v_d uuid[]; v_g uuid[]; v_cap uuid; v_vice uuid;
  v_old_sub text:=current_setting('request.jwt.claim.sub',true);
  v_old_role text:=current_setting('request.jwt.claim.role',true);
  v_count integer; v_f_count integer; v_d_count integer; v_g_count integer; v_l1 integer; v_l2 integer;
begin
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;

  select array_agg(id order by id) into v_f from (select id from fantasy_players where active=true and position in('C','W') order by id limit 6) q;
  select array_agg(id order by id) into v_d from (select id from fantasy_players where active=true and position='D' order by id limit 4) q;
  select array_agg(id order by id) into v_g from (select id from fantasy_players where active=true and position='G' order by id limit 2) q;
  if coalesce(array_length(v_f,1),0)<>6 or coalesce(array_length(v_d,1),0)<>4 or coalesce(array_length(v_g,1),0)<>2 then raise exception 'Need 6F/4D/2G active players'; end if;
  v_cap:=v_f[1]; v_vice:=v_f[2];

  insert into fantasy_user_teams(user_id,season,name,budget) values(v_user,v_season,'MP12 snapshot E2E',100) returning id into v_team;
  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status)
  values(v_season,1,'MP12 snapshot E2E',now()-interval '2 hours',now()-interval '1 hour',now()+interval '1 hour','locked') returning id into v_round;

  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain,line_no) values
    (v_team,v_f[1],5,true,false,1),(v_team,v_f[2],5,false,true,1),(v_team,v_f[3],5,false,false,1),
    (v_team,v_d[1],5,false,false,1),(v_team,v_d[2],5,false,false,1),(v_team,v_g[1],5,false,false,1),
    (v_team,v_f[4],5,false,false,2),(v_team,v_f[5],5,false,false,2),(v_team,v_f[6],5,false,false,2),
    (v_team,v_d[3],5,false,false,2),(v_team,v_d[4],5,false,false,2),(v_team,v_g[2],5,false,false,2);

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  v_snapshot:=snapshot_fantasy_team_for_round(v_round);
  v_snapshot_again:=snapshot_fantasy_team_for_round(v_round);

  select count(*),count(*) filter(where position in('C','W')),count(*) filter(where position='D'),count(*) filter(where position='G'),count(*) filter(where line_no=1),count(*) filter(where line_no=2)
  into v_count,v_f_count,v_d_count,v_g_count,v_l1,v_l2 from fantasy_team_round_snapshot_players where snapshot_id=v_snapshot;

  return query select 1,'Snapshot is created and idempotent'::text,v_snapshot is not null and v_snapshot_again=v_snapshot,format('snapshot=%s again=%s',v_snapshot,v_snapshot_again);
  return query select 2,'Snapshot preserves 6F/4D/2G and two lines'::text,v_count=12 and v_f_count=6 and v_d_count=4 and v_g_count=2 and v_l1=6 and v_l2=6,format('count=%s F=%s D=%s G=%s L1=%s L2=%s',v_count,v_f_count,v_d_count,v_g_count,v_l1,v_l2);
  return query select 3,'Snapshot preserves captain and vice'::text,
    exists(select 1 from fantasy_team_round_snapshot_players where snapshot_id=v_snapshot and player_id=v_cap and is_captain and not is_vice_captain)
    and exists(select 1 from fantasy_team_round_snapshot_players where snapshot_id=v_snapshot and player_id=v_vice and is_vice_captain and not is_captain),format('captain=%s vice=%s',v_cap,v_vice);

  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  return query select 4,'Synthetic snapshot fixtures cleaned'::text,not exists(select 1 from fantasy_user_teams where season=v_season) and not exists(select 1 from fantasy_rounds where season=v_season) and not exists(select 1 from fantasy_team_round_snapshots where season=v_season),'cleanup complete'::text;
exception when others then
  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
  delete from fantasy_user_teams where season=v_season;
  delete from fantasy_rounds where season=v_season;
  raise;
end;
$$;

revoke all on function public.run_mp12_snapshot_freeze_e2e_v1() from public,anon,authenticated;
grant execute on function public.run_mp12_snapshot_freeze_e2e_v1() to service_role;
