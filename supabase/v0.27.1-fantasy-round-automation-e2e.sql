-- Stang Inn Fantasy Hockey – v0.27.1
-- Harden v0.27 readiness and add a fully isolated E2E test.
--
-- Production fix:
-- A finished game is score-ready only when it has at least one did_play=true stat row
-- and EVERY did_play=true stat row has a corresponding fantasy_player_points row.
-- This prevents a partially materialized match from finalizing a fantasy round.
--
-- E2E safety:
-- Test season is __e2e_v027__. It copies only player references/prices from one valid
-- 2026/27 roster, creates its own round/game/team rows, and deletes the whole test season
-- before and after each run. No production 2026/27 round/game/team row is updated.

create or replace function fantasy_game_points_ready(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(
      select 1
      from fantasy_player_game_stats pgs
      where pgs.game_id=p_game_id
        and pgs.did_play=true
    )
    and not exists(
      select 1
      from fantasy_player_game_stats pgs
      where pgs.game_id=p_game_id
        and pgs.did_play=true
        and not exists(
          select 1
          from fantasy_player_points fpp
          where fpp.game_id=pgs.game_id
            and fpp.player_id=pgs.player_id
        )
    );
$$;

revoke all on function fantasy_game_points_ready(uuid) from public;
revoke all on function fantasy_game_points_ready(uuid) from anon;
revoke all on function fantasy_game_points_ready(uuid) from authenticated;
revoke all on function fantasy_game_points_ready(uuid) from service_role;

create or replace function process_fantasy_rounds_automation(
  p_season text,
  p_include_test_rounds boolean default false
) returns table(
  due_rounds integer,
  teams_checked integer,
  snapshots_created integer,
  already_frozen integer,
  snapshot_errors integer,
  ready_rounds integer,
  scored_rounds integer,
  scored_snapshots integer,
  skipped_unfinished integer,
  skipped_points_not_ready integer,
  status_updates integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_round record;
  v_team record;
  v_score record;
  v_before uuid;
  v_due integer := 0;
  v_checked integer := 0;
  v_created integer := 0;
  v_existing integer := 0;
  v_errors integer := 0;
  v_ready integer := 0;
  v_scored_rounds integer := 0;
  v_scored_snapshots integer := 0;
  v_unfinished integer := 0;
  v_points_not_ready integer := 0;
  v_status_updates integer := 0;
  v_game_count integer;
  v_finished_count integer;
  v_points_game_count integer;
  v_needs_scoring boolean;
  v_new_status text;
begin
  if v_role <> 'service_role' then
    if v_user is null then raise exception 'Not authenticated'; end if;
    if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
      raise exception 'Admin access required';
    end if;
  end if;

  if p_season is null or btrim(p_season)='' then
    raise exception 'Season is required';
  end if;

  select count(*)::integer into v_due
  from fantasy_rounds r
  where r.season=p_season
    and r.deadline_at<=now()
    and (p_include_test_rounds or r.round_no<9000);

  for v_round in
    select r.id,r.round_no,r.deadline_at,r.status
    from fantasy_rounds r
    where r.season=p_season
      and (p_include_test_rounds or r.round_no<9000)
    order by r.deadline_at,r.round_no
  loop
    select
      count(*)::integer,
      count(*) filter(where g.status='finished')::integer,
      count(*) filter(where g.status='finished' and fantasy_game_points_ready(g.id))::integer
    into v_game_count,v_finished_count,v_points_game_count
    from fantasy_games g
    where g.fantasy_round_id=v_round.id;

    v_new_status := case
      when now()<v_round.deadline_at then 'open'
      when v_game_count>0 and v_finished_count=v_game_count then 'finished'
      else 'locked'
    end;

    if v_round.status is distinct from v_new_status then
      update fantasy_rounds
      set status=v_new_status,updated_at=now()
      where id=v_round.id;
      v_status_updates:=v_status_updates+1;
    end if;

    if v_round.deadline_at>now() then
      continue;
    end if;

    for v_team in
      select t.id from fantasy_user_teams t where t.season=p_season
    loop
      v_checked:=v_checked+1;
      select s.id into v_before
      from fantasy_team_round_snapshots s
      where s.round_id=v_round.id and s.team_id=v_team.id;

      if v_before is not null then
        v_existing:=v_existing+1;
      else
        begin
          perform freeze_fantasy_team_for_round_internal(v_team.id,v_round.id,now());
          v_created:=v_created+1;
        exception when others then
          v_errors:=v_errors+1;
        end;
      end if;
    end loop;

    if v_game_count=0 or v_finished_count<>v_game_count then
      v_unfinished:=v_unfinished+1;
      continue;
    end if;

    if v_points_game_count<>v_game_count then
      v_points_not_ready:=v_points_not_ready+1;
      continue;
    end if;

    v_ready:=v_ready+1;

    select
      exists(
        select 1
        from fantasy_team_round_snapshots s
        left join fantasy_team_round_points trp on trp.snapshot_id=s.id
        where s.round_id=v_round.id and trp.id is null
      )
      or exists(
        select 1
        from fantasy_player_points fpp
        join fantasy_games g on g.id=fpp.game_id
        where g.fantasy_round_id=v_round.id
          and fpp.calculated_at > coalesce(
            (select min(trp.calculated_at)
             from fantasy_team_round_points trp
             where trp.round_id=v_round.id),
            '-infinity'::timestamptz
          )
      )
    into v_needs_scoring;

    if not v_needs_scoring then
      continue;
    end if;

    select * into v_score
    from calculate_fantasy_round_team_points_internal(v_round.id);

    v_scored_rounds:=v_scored_rounds+1;
    v_scored_snapshots:=v_scored_snapshots+coalesce(v_score.snapshots_scored,0);
  end loop;

  return query select
    v_due,v_checked,v_created,v_existing,v_errors,v_ready,
    v_scored_rounds,v_scored_snapshots,v_unfinished,v_points_not_ready,v_status_updates;
end;
$$;

revoke all on function process_fantasy_rounds_automation(text,boolean) from public;
revoke all on function process_fantasy_rounds_automation(text,boolean) from anon;
grant execute on function process_fantasy_rounds_automation(text,boolean) to authenticated;
grant execute on function process_fantasy_rounds_automation(text,boolean) to service_role;

-- Internal cleanup for the isolated automation test season.
create or replace function cleanup_fantasy_round_automation_e2e_internal()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from fantasy_games where season='__e2e_v027__';
  delete from fantasy_rounds where season='__e2e_v027__';
  delete from fantasy_user_teams where season='__e2e_v027__';
end;
$$;

revoke all on function cleanup_fantasy_round_automation_e2e_internal() from public;
revoke all on function cleanup_fantasy_round_automation_e2e_internal() from anon;
revoke all on function cleanup_fantasy_round_automation_e2e_internal() from authenticated;
revoke all on function cleanup_fantasy_round_automation_e2e_internal() from service_role;

create or replace function run_fantasy_round_automation_e2e_test()
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
  v_source_team uuid;
  v_test_user uuid := gen_random_uuid();
  v_test_team uuid;
  v_round uuid;
  v_game uuid;
  v_cap uuid;
  v_vice uuid;
  v_other uuid;
  v_run record;
  v_first_snapshot uuid;
  v_first_score_time timestamptz;
  v_score_total numeric;
  v_prod_rounds_before bigint;
  v_prod_games_before bigint;
  v_prod_points_before bigint;
  v_prod_rounds_after bigint;
  v_prod_games_after bigint;
  v_prod_points_after bigint;
  v_checks boolean[] := array[]::boolean[];
  v_details text[] := array[]::text[];
begin
  perform cleanup_fantasy_round_automation_e2e_internal();

  select count(*),
         (select count(*) from fantasy_games where season='2026/27'),
         (select count(*) from fantasy_team_round_points where season='2026/27')
  into v_prod_rounds_before,v_prod_games_before,v_prod_points_before
  from fantasy_rounds where season='2026/27';

  select t.id into v_source_team
  from fantasy_user_teams t
  where t.season='2026/27'
    and (select count(*) from fantasy_user_team_players tp where tp.team_id=t.id)=12
    and (select count(*) from fantasy_user_team_players tp where tp.team_id=t.id and tp.is_captain)=1
    and (select count(*) from fantasy_user_team_players tp where tp.team_id=t.id and tp.is_vice_captain)=1
  order by t.created_at,t.id
  limit 1;

  if v_source_team is null then
    raise exception 'E2E requires at least one valid 12-player 2026/27 fantasy team';
  end if;

  insert into fantasy_user_teams(user_id,season,name,budget)
  values(v_test_user,'__e2e_v027__','TEST · v0.27 automation',100)
  returning id into v_test_team;

  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain)
  select v_test_team,tp.player_id,tp.purchase_price,tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  where tp.team_id=v_source_team;

  select player_id into v_cap from fantasy_user_team_players
  where team_id=v_test_team and is_captain limit 1;
  select player_id into v_vice from fantasy_user_team_players
  where team_id=v_test_team and is_vice_captain limit 1;
  select player_id into v_other from fantasy_user_team_players
  where team_id=v_test_team and player_id not in(v_cap,v_vice)
  order by player_id limit 1;

  insert into fantasy_rounds(
    season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at
  ) values(
    '__e2e_v027__',9996,'TEST · v0.27 automation lifecycle',
    now()-interval '2 hours',now()-interval '3 hours',now()+interval '1 hour','locked',now(),now()
  ) returning id into v_round;

  insert into fantasy_games(
    external_id,season,round_no,fantasy_round_no,starts_at,home_team,away_team,
    home_score,away_score,status,fantasy_round_id,updated_at
  ) values(
    'test:v027:automation','__e2e_v027__',9996,9996,now()-interval '2 hours',
    'TEST HOME','TEST AWAY',null,null,'scheduled',v_round,now()
  ) returning id into v_game;

  -- 1) Deadline passed: snapshot must be created, but unfinished game must not score.
  select * into v_run from process_fantasy_rounds_automation('__e2e_v027__',true);
  select id into v_first_snapshot from fantasy_team_round_snapshots
  where round_id=v_round and team_id=v_test_team;
  v_checks:=array_append(v_checks,
    v_first_snapshot is not null
    and v_run.snapshots_created=1
    and v_run.scored_rounds=0
    and v_run.skipped_unfinished=1
  );
  v_details:=array_append(v_details,format(
    'snapshot=%s created=%s scored=%s unfinished=%s',
    coalesce(v_first_snapshot::text,'NULL'),v_run.snapshots_created,v_run.scored_rounds,v_run.skipped_unfinished
  ));

  -- Finish game and create 3 played stat rows, but only 2 point rows.
  update fantasy_games
  set status='finished',home_score=2,away_score=1,updated_at=now()
  where id=v_game;

  insert into fantasy_player_game_stats(player_id,game_id,did_play,position_snapshot,team_snapshot,raw)
  select v_cap,v_game,true,fp.position,fp.team,'{"test":"v0.27.1","role":"captain"}'::jsonb
  from fantasy_players fp where fp.id=v_cap
  union all
  select v_vice,v_game,true,fp.position,fp.team,'{"test":"v0.27.1","role":"vice"}'::jsonb
  from fantasy_players fp where fp.id=v_vice
  union all
  select v_other,v_game,true,fp.position,fp.team,'{"test":"v0.27.1","role":"other"}'::jsonb
  from fantasy_players fp where fp.id=v_other;

  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version,breakdown,calculated_at)
  values
    (v_cap,v_game,10,'test-v0.27.1','{"test":true}'::jsonb,now()),
    (v_vice,v_game,7,'test-v0.27.1','{"test":true}'::jsonb,now());

  -- 2) Partial materialization must block scoring.
  select * into v_run from process_fantasy_rounds_automation('__e2e_v027__',true);
  v_checks:=array_append(v_checks,
    v_run.scored_rounds=0
    and v_run.skipped_points_not_ready=1
    and not exists(select 1 from fantasy_team_round_points where round_id=v_round)
  );
  v_details:=array_append(v_details,format(
    'scored=%s points_not_ready=%s score_rows=%s',
    v_run.scored_rounds,v_run.skipped_points_not_ready,
    (select count(*) from fantasy_team_round_points where round_id=v_round)
  ));

  -- Add the missing materialized player point.
  insert into fantasy_player_points(player_id,game_id,actual_points,calculation_version,breakdown,calculated_at)
  values(v_other,v_game,3,'test-v0.27.1','{"test":true}'::jsonb,now());

  -- 3) Complete finished game must score exactly once; captain gets x2.
  select * into v_run from process_fantasy_rounds_automation('__e2e_v027__',true);
  select total_points,calculated_at into v_score_total,v_first_score_time
  from fantasy_team_round_points where round_id=v_round and team_id=v_test_team;
  v_checks:=array_append(v_checks,
    v_run.ready_rounds=1
    and v_run.scored_rounds=1
    and v_run.scored_snapshots=1
    and v_score_total=30
  );
  v_details:=array_append(v_details,format(
    'ready=%s scored=%s snapshots=%s total=%s',
    v_run.ready_rounds,v_run.scored_rounds,v_run.scored_snapshots,coalesce(v_score_total::text,'NULL')
  ));

  -- 4) Re-running without newer player points must be idempotent.
  perform pg_sleep(0.01);
  select * into v_run from process_fantasy_rounds_automation('__e2e_v027__',true);
  v_checks:=array_append(v_checks,
    v_run.scored_rounds=0
    and (select calculated_at from fantasy_team_round_points where round_id=v_round and team_id=v_test_team)=v_first_score_time
  );
  v_details:=array_append(v_details,format(
    'rescored=%s timestamp_unchanged=%s',
    v_run.scored_rounds,
    ((select calculated_at from fantasy_team_round_points where round_id=v_round and team_id=v_test_team)=v_first_score_time)
  ));

  -- 5) Production counts must be unchanged.
  select count(*),
         (select count(*) from fantasy_games where season='2026/27'),
         (select count(*) from fantasy_team_round_points where season='2026/27')
  into v_prod_rounds_after,v_prod_games_after,v_prod_points_after
  from fantasy_rounds where season='2026/27';

  v_checks:=array_append(v_checks,
    v_prod_rounds_before=v_prod_rounds_after
    and v_prod_games_before=v_prod_games_after
    and v_prod_points_before=v_prod_points_after
  );
  v_details:=array_append(v_details,format(
    'rounds %s→%s, games %s→%s, team-point rows %s→%s',
    v_prod_rounds_before,v_prod_rounds_after,
    v_prod_games_before,v_prod_games_after,
    v_prod_points_before,v_prod_points_after
  ));

  perform cleanup_fantasy_round_automation_e2e_internal();

  return query
  select 1,'Deadline fryser laget, men scorer ikke uferdig kamp',v_checks[1],v_details[1]
  union all
  select 2,'Delvis materialiserte spillerpoeng blokkerer scoring',v_checks[2],v_details[2]
  union all
  select 3,'Ferdig og komplett runde scores med kaptein ×2',v_checks[3],v_details[3]
  union all
  select 4,'Ny kjøring er idempotent',v_checks[4],v_details[4]
  union all
  select 5,'Ekte 2026/27-data er urørt',v_checks[5],v_details[5];
exception when others then
  perform cleanup_fantasy_round_automation_e2e_internal();
  raise;
end;
$$;

revoke all on function run_fantasy_round_automation_e2e_test() from public;
revoke all on function run_fantasy_round_automation_e2e_test() from anon;
revoke all on function run_fantasy_round_automation_e2e_test() from authenticated;
revoke all on function run_fantasy_round_automation_e2e_test() from service_role;

comment on function run_fantasy_round_automation_e2e_test() is
  'SQL-editor-only isolated E2E for v0.27 lifecycle. Uses __e2e_v027__ and cleans all fixtures before/after.';
