-- Stang Inn Fantasy Hockey – v0.30.1
-- Isolated E2E for the 2026/27 captain rules:
-- Captain = x2.0 when playing; vice-captain = x1.5 when playing.
-- Vice-captain stays x1.5 even when captain does not play.
-- Uses test rounds 9995/9996 and test games only; real 2026/27 rows are not modified.

create or replace function run_fantasy_captain_vice_e2e_test()
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
  v_season text := '2026/27';
  v_admin uuid;
  v_team uuid;
  v_cap uuid;
  v_vice uuid;
  v_other uuid;
  v_round_a uuid;
  v_round_b uuid;
  v_game_a uuid;
  v_game_b uuid;
  v_snap_a uuid;
  v_snap_b uuid;
  v_value numeric(10,2);
  v_a record;
  v_b record;
  v_cap_row record;
  v_vice_a_row record;
  v_vice_b_row record;
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
  from fantasy_rounds r
  where r.season=v_season and r.round_no<9000;

  select count(*) into v_real_games_before
  from fantasy_games g
  where g.season=v_season
    and g.external_id not in ('test:captain-vice-e2e:A','test:captain-vice-e2e:B');

  select count(*) into v_real_teams_before
  from fantasy_user_teams t
  where t.season=v_season;

  -- Find an existing admin who has a complete live fantasy team. The live team is read only.
  select p.id,t.id
  into v_admin,v_team
  from players p
  join fantasy_user_teams t on t.user_id=p.id and t.season=v_season
  where coalesce(p.admin,false)
    and (select count(*) from fantasy_user_team_players tp where tp.team_id=t.id)=12
  order by p.id
  limit 1;

  if v_admin is null or v_team is null then
    raise exception 'E2E requires an admin with a complete 12-player 2026/27 fantasy team';
  end if;

  select tp.player_id into v_cap
  from fantasy_user_team_players tp
  where tp.team_id=v_team and tp.is_captain
  limit 1;

  select tp.player_id into v_vice
  from fantasy_user_team_players tp
  where tp.team_id=v_team and tp.is_vice_captain
  limit 1;

  select tp.player_id into v_other
  from fantasy_user_team_players tp
  where tp.team_id=v_team
    and tp.player_id<>v_cap
    and tp.player_id<>v_vice
  order by tp.player_id
  limit 1;

  if v_cap is null or v_vice is null or v_other is null then
    raise exception 'E2E requires captain, vice-captain and one other player';
  end if;

  select coalesce(sum(tp.purchase_price),0)
  into v_value
  from fantasy_user_team_players tp
  where tp.team_id=v_team;

  -- Defensive cleanup of this test namespace only.
  delete from fantasy_games g
  where g.season=v_season
    and g.external_id in ('test:captain-vice-e2e:A','test:captain-vice-e2e:B');

  delete from fantasy_rounds r
  where r.season=v_season
    and r.round_no in (9995,9996);

  insert into fantasy_rounds(
    season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at
  ) values(
    v_season,9995,'TEST · C x2 + VC x1.5',
    now()-interval '2 hours',now()-interval '3 hours',now()-interval '1 hour','finished',now(),now()
  ) returning id into v_round_a;

  insert into fantasy_rounds(
    season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at
  ) values(
    v_season,9996,'TEST · VC remains x1.5 without C',
    now()-interval '2 hours',now()-interval '3 hours',now()-interval '1 hour','finished',now(),now()
  ) returning id into v_round_b;

  insert into fantasy_games(
    external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id,updated_at
  ) values(
    'test:captain-vice-e2e:A',v_season,9995,now()-interval '2 hours',
    'TEST HOME','TEST AWAY','finished',v_round_a,now()
  ) returning id into v_game_a;

  insert into fantasy_games(
    external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id,updated_at
  ) values(
    'test:captain-vice-e2e:B',v_season,9996,now()-interval '2 hours',
    'TEST HOME','TEST AWAY','finished',v_round_b,now()
  ) returning id into v_game_b;

  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at
  )
  select v_round_a,t.id,t.user_id,v_season,t.name,v_value,now()
  from fantasy_user_teams t where t.id=v_team
  returning id into v_snap_a;

  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at
  )
  select v_round_b,t.id,t.user_id,v_season,t.name,v_value,now()
  from fantasy_user_teams t where t.id=v_team
  returning id into v_snap_b;

  insert into fantasy_team_round_snapshot_players(
    snapshot_id,player_id,position,team,price,is_captain,is_vice_captain
  )
  select v_snap_a,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team;

  insert into fantasy_team_round_snapshot_players(
    snapshot_id,player_id,position,team,price,is_captain,is_vice_captain
  )
  select v_snap_b,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team;

  -- Scenario A: C=10 raw, VC=8 raw, other=2 raw.
  -- Expected: base 20, C bonus 10, VC bonus 4, total 34.
  insert into fantasy_player_game_stats(player_id,game_id,raw)
  values
    (v_cap,v_game_a,'{"test":"v0.30.1","scenario":"A","role":"captain"}'::jsonb),
    (v_vice,v_game_a,'{"test":"v0.30.1","scenario":"A","role":"vice"}'::jsonb),
    (v_other,v_game_a,'{"test":"v0.30.1","scenario":"A","role":"other"}'::jsonb);

  insert into fantasy_player_points(
    player_id,game_id,actual_points,calculation_version,breakdown,calculated_at
  ) values
    (v_cap,v_game_a,10,'test-v0.30.1','{"test":true,"scenario":"A"}'::jsonb,now()),
    (v_vice,v_game_a,8,'test-v0.30.1','{"test":true,"scenario":"A"}'::jsonb,now()),
    (v_other,v_game_a,2,'test-v0.30.1','{"test":true,"scenario":"A"}'::jsonb,now());

  -- Scenario B: captain does not play. VC=8 raw, other=2 raw.
  -- Expected: base 10, C bonus 0, VC bonus 4, total 14.
  insert into fantasy_player_game_stats(player_id,game_id,raw)
  values
    (v_vice,v_game_b,'{"test":"v0.30.1","scenario":"B","role":"vice"}'::jsonb),
    (v_other,v_game_b,'{"test":"v0.30.1","scenario":"B","role":"other"}'::jsonb);

  insert into fantasy_player_points(
    player_id,game_id,actual_points,calculation_version,breakdown,calculated_at
  ) values
    (v_vice,v_game_b,8,'test-v0.30.1','{"test":true,"scenario":"B"}'::jsonb,now()),
    (v_other,v_game_b,2,'test-v0.30.1','{"test":true,"scenario":"B"}'::jsonb,now());

  -- calculate_fantasy_round_team_points requires authenticated admin context.
  v_old_sub := current_setting('request.jwt.claim.sub',true);
  v_old_role := current_setting('request.jwt.claim.role',true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  perform * from calculate_fantasy_round_team_points(v_round_a);
  perform * from calculate_fantasy_round_team_points(v_round_b);

  select trp.* into v_a
  from fantasy_team_round_points trp
  where trp.round_id=v_round_a and trp.team_id=v_team;

  select trp.* into v_b
  from fantasy_team_round_points trp
  where trp.round_id=v_round_b and trp.team_id=v_team;

  select prp.* into v_cap_row
  from fantasy_team_round_player_points prp
  where prp.team_round_points_id=v_a.id and prp.player_id=v_cap;

  select prp.* into v_vice_a_row
  from fantasy_team_round_player_points prp
  where prp.team_round_points_id=v_a.id and prp.player_id=v_vice;

  select prp.* into v_vice_b_row
  from fantasy_team_round_player_points prp
  where prp.team_round_points_id=v_b.id and prp.player_id=v_vice;

  return query
  select 1,'Kaptein får ×2 når han spiller'::text,
    v_cap_row.played=true
      and v_cap_row.raw_points=10
      and v_cap_row.multiplier=2.00
      and v_cap_row.bonus_points=10
      and v_cap_row.total_points=20,
    format('raw=%s x%s bonus=%s total=%s',v_cap_row.raw_points,v_cap_row.multiplier,v_cap_row.bonus_points,v_cap_row.total_points);

  return query
  select 2,'Visekaptein får ×1,5 samtidig med kaptein'::text,
    v_vice_a_row.played=true
      and v_vice_a_row.raw_points=8
      and v_vice_a_row.multiplier=1.50
      and v_vice_a_row.bonus_points=4
      and v_vice_a_row.total_points=12,
    format('raw=%s x%s bonus=%s total=%s',v_vice_a_row.raw_points,v_vice_a_row.multiplier,v_vice_a_row.bonus_points,v_vice_a_row.total_points);

  return query
  select 3,'VC beholder ×1,5 når kapteinen ikke spiller'::text,
    v_vice_b_row.played=true
      and v_vice_b_row.multiplier=1.50
      and v_vice_b_row.bonus_points=4
      and v_vice_b_row.total_points=12
      and not exists(
        select 1
        from fantasy_team_round_player_points prp
        where prp.team_round_points_id=v_b.id
          and prp.player_id=v_cap
          and prp.played=true
      ),
    format('VC raw=%s x%s bonus=%s total=%s',v_vice_b_row.raw_points,v_vice_b_row.multiplier,v_vice_b_row.bonus_points,v_vice_b_row.total_points);

  return query
  select 4,'Rundetotaler og scoringversjon er korrekte'::text,
    v_a.base_points=20
      and v_a.captain_bonus=10
      and v_a.vice_captain_bonus=4
      and v_a.total_points=34
      and v_a.calculation_version='team-v2-c2-vc1.5'
      and v_b.base_points=10
      and v_b.captain_bonus=0
      and v_b.vice_captain_bonus=4
      and v_b.total_points=14
      and v_b.calculation_version='team-v2-c2-vc1.5'
      and (select count(*) from fantasy_team_round_player_points prp where prp.team_round_points_id=v_a.id)=12
      and (select count(*) from fantasy_team_round_player_points prp where prp.team_round_points_id=v_b.id)=12,
    format('A base=%s C=%s VC=%s total=%s · B base=%s C=%s VC=%s total=%s · version=%s',
      v_a.base_points,v_a.captain_bonus,v_a.vice_captain_bonus,v_a.total_points,
      v_b.base_points,v_b.captain_bonus,v_b.vice_captain_bonus,v_b.total_points,
      v_a.calculation_version);

  -- Restore caller claims before cleanup.
  perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);

  -- Cleanup only isolated fixtures. Cascades remove stats, player points, snapshots and round scores.
  delete from fantasy_games g
  where g.id in (v_game_a,v_game_b);

  delete from fantasy_rounds r
  where r.id in (v_round_a,v_round_b);

  select count(*) into v_real_rounds_after
  from fantasy_rounds r
  where r.season=v_season and r.round_no<9000;

  select count(*) into v_real_games_after
  from fantasy_games g
  where g.season=v_season
    and g.external_id not in ('test:captain-vice-e2e:A','test:captain-vice-e2e:B');

  select count(*) into v_real_teams_after
  from fantasy_user_teams t
  where t.season=v_season;

  return query
  select 5,'Ekte 2026/27-data er urørt og testen er ryddet'::text,
    v_real_rounds_before=v_real_rounds_after
      and v_real_games_before=v_real_games_after
      and v_real_teams_before=v_real_teams_after
      and not exists(select 1 from fantasy_rounds r where r.season=v_season and r.round_no in (9995,9996))
      and not exists(select 1 from fantasy_games g where g.season=v_season and g.external_id in ('test:captain-vice-e2e:A','test:captain-vice-e2e:B')),
    format('rounds %s→%s, games %s→%s, teams %s→%s',
      v_real_rounds_before,v_real_rounds_after,
      v_real_games_before,v_real_games_after,
      v_real_teams_before,v_real_teams_after);

exception when others then
  begin
    perform set_config('request.jwt.claim.sub',coalesce(v_old_sub,''),true);
    perform set_config('request.jwt.claim.role',coalesce(v_old_role,''),true);
    delete from fantasy_games g
    where g.season=v_season
      and g.external_id in ('test:captain-vice-e2e:A','test:captain-vice-e2e:B');
    delete from fantasy_rounds r
    where r.season=v_season and r.round_no in (9995,9996);
  exception when others then null;
  end;
  raise;
end;
$$;

revoke all on function run_fantasy_captain_vice_e2e_test() from public;
grant execute on function run_fantasy_captain_vice_e2e_test() to service_role;
