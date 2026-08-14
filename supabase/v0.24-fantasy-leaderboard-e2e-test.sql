-- Stang Inn Fantasy Hockey – v0.24
-- Isolated admin-only E2E test for season leaderboard, round ranking and team history.
-- Uses a dedicated test season so no test team ever appears in the real 2026/27 table.

create or replace function cleanup_fantasy_leaderboard_e2e_test()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_deleted integer:=0;
  v_rows integer:=0;
  v_test_season constant text:='TEST-v0.24-leaderboard';
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  -- Team deletion cascades snapshots and team-round point rows.
  delete from fantasy_user_teams t where t.season=v_test_season;
  get diagnostics v_rows=row_count;
  v_deleted:=v_deleted+v_rows;

  delete from fantasy_rounds r where r.season=v_test_season;
  get diagnostics v_rows=row_count;
  v_deleted:=v_deleted+v_rows;

  return v_deleted;
end;
$$;

revoke all on function cleanup_fantasy_leaderboard_e2e_test() from public;
grant execute on function cleanup_fantasy_leaderboard_e2e_test() to authenticated;


create or replace function create_fantasy_leaderboard_e2e_test()
returns table(
  test_season text,
  test_teams integer,
  test_rounds integer,
  test_results integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_test_season constant text:='TEST-v0.24-leaderboard';
  v_team_a uuid;
  v_team_b uuid;
  v_team_c uuid;
  v_team_d uuid;
  v_round_1 uuid;
  v_round_2 uuid;
  v_round_3 uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  -- Start clean. Inline cleanup avoids nested auth/function assumptions.
  delete from fantasy_user_teams t where t.season=v_test_season;
  delete from fantasy_rounds r where r.season=v_test_season;

  insert into fantasy_user_teams(user_id,season,name,budget,created_at,updated_at)
  values(gen_random_uuid(),v_test_season,'TEST A · Arctic Owls',100,now(),now())
  returning id into v_team_a;

  insert into fantasy_user_teams(user_id,season,name,budget,created_at,updated_at)
  values(gen_random_uuid(),v_test_season,'TEST B · Blue Lines',100,now(),now())
  returning id into v_team_b;

  insert into fantasy_user_teams(user_id,season,name,budget,created_at,updated_at)
  values(gen_random_uuid(),v_test_season,'TEST C · Crossbars',100,now(),now())
  returning id into v_team_c;

  insert into fantasy_user_teams(user_id,season,name,budget,created_at,updated_at)
  values(gen_random_uuid(),v_test_season,'TEST D · Dump & Chase',100,now(),now())
  returning id into v_team_d;

  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at)
  values(v_test_season,1,'TEST Leaderboard Runde 1',now()-interval '9 hours',now()-interval '10 hours',now()-interval '8 hours','finished',now(),now())
  returning id into v_round_1;

  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at)
  values(v_test_season,2,'TEST Leaderboard Runde 2',now()-interval '6 hours',now()-interval '7 hours',now()-interval '5 hours','finished',now(),now())
  returning id into v_round_2;

  insert into fantasy_rounds(season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at)
  values(v_test_season,3,'TEST Leaderboard Runde 3',now()-interval '3 hours',now()-interval '4 hours',now()-interval '2 hours','finished',now(),now())
  returning id into v_round_3;

  -- One snapshot per test team/round. No roster rows are needed because this test validates leaderboard aggregation only.
  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value,captured_at)
  select
    r.id,
    t.id,
    t.user_id,
    v_test_season,
    t.name,
    100,
    r.deadline_at
  from fantasy_user_teams t
  cross join fantasy_rounds r
  where t.season=v_test_season
    and r.season=v_test_season;

  -- Controlled scores:
  -- R1: A20 B15 C10 D12       => A wins
  -- R2: A10 B20 C20 D10       => B/C share win
  -- R3: A15 B10 C15 D8        => A/C share win
  -- Season totals: A45 B45 C45 D30 => A/B/C share #1, D is #2 (dense rank).
  insert into fantasy_team_round_points(
    snapshot_id,round_id,team_id,user_id,season,
    base_points,captain_bonus,vice_captain_bonus,total_points,
    calculation_version,calculated_at
  )
  select
    s.id,
    s.round_id,
    s.team_id,
    s.user_id,
    v_test_season,
    case
      when t.id=v_team_a and r.round_no=1 then 20
      when t.id=v_team_a and r.round_no=2 then 10
      when t.id=v_team_a and r.round_no=3 then 15
      when t.id=v_team_b and r.round_no=1 then 15
      when t.id=v_team_b and r.round_no=2 then 20
      when t.id=v_team_b and r.round_no=3 then 10
      when t.id=v_team_c and r.round_no=1 then 10
      when t.id=v_team_c and r.round_no=2 then 20
      when t.id=v_team_c and r.round_no=3 then 15
      when t.id=v_team_d and r.round_no=1 then 12
      when t.id=v_team_d and r.round_no=2 then 10
      when t.id=v_team_d and r.round_no=3 then 8
      else 0
    end::numeric,
    0,
    0,
    case
      when t.id=v_team_a and r.round_no=1 then 20
      when t.id=v_team_a and r.round_no=2 then 10
      when t.id=v_team_a and r.round_no=3 then 15
      when t.id=v_team_b and r.round_no=1 then 15
      when t.id=v_team_b and r.round_no=2 then 20
      when t.id=v_team_b and r.round_no=3 then 10
      when t.id=v_team_c and r.round_no=1 then 10
      when t.id=v_team_c and r.round_no=2 then 20
      when t.id=v_team_c and r.round_no=3 then 15
      when t.id=v_team_d and r.round_no=1 then 12
      when t.id=v_team_d and r.round_no=2 then 10
      when t.id=v_team_d and r.round_no=3 then 8
      else 0
    end::numeric,
    'test-v0.24',
    now()
  from fantasy_team_round_snapshots s
  join fantasy_user_teams t on t.id=s.team_id
  join fantasy_rounds r on r.id=s.round_id
  where s.season=v_test_season;

  return query
  select
    v_test_season,
    (select count(*)::integer from fantasy_user_teams t where t.season=v_test_season),
    (select count(*)::integer from fantasy_rounds r where r.season=v_test_season),
    (select count(*)::integer from fantasy_team_round_points trp where trp.season=v_test_season);
end;
$$;

revoke all on function create_fantasy_leaderboard_e2e_test() from public;
grant execute on function create_fantasy_leaderboard_e2e_test() to authenticated;


create or replace function run_fantasy_leaderboard_e2e_test()
returns table(
  check_name text,
  expected_value text,
  actual_value text,
  passed boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_test_season constant text:='TEST-v0.24-leaderboard';
  v_round_2 uuid;
  v_team_a uuid;
  v_actual text;
  v_ok boolean;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  if (select count(*) from fantasy_user_teams t where t.season=v_test_season)<>4 then
    raise exception 'Leaderboard test fixture is missing. Create it first.';
  end if;

  -- 1. Season totals + shared #1 + dense-rank #2.
  select string_agg(
    l.team_name||'=#'||l.standings_position||'/'||trim(to_char(l.total_points,'FM999990.00')),
    ' | ' order by l.team_name
  )
  into v_actual
  from get_fantasy_season_leaderboard(v_test_season) l;

  v_ok := v_actual =
    'TEST A · Arctic Owls=#1/45.00 | TEST B · Blue Lines=#1/45.00 | TEST C · Crossbars=#1/45.00 | TEST D · Dump & Chase=#2/30.00';

  return query select
    'Sesongtotal + delt plassering'::text,
    'A/B/C #1 med 45 · D #2 med 30'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 2. Round wins.
  select string_agg(
    l.team_name||'='||l.round_wins,
    ' | ' order by l.team_name
  )
  into v_actual
  from get_fantasy_season_leaderboard(v_test_season) l;

  v_ok := v_actual =
    'TEST A · Arctic Owls=2 | TEST B · Blue Lines=1 | TEST C · Crossbars=2 | TEST D · Dump & Chase=0';

  return query select
    'Rundeseire inkl. delte vinnere'::text,
    'A=2 · B=1 · C=2 · D=0'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 3. Average, best and latest round values.
  select string_agg(
    l.team_name||'=snitt '||trim(to_char(l.average_round_points,'FM999990.00'))||
    '/beste '||trim(to_char(l.best_round_points,'FM999990.00'))||
    '/siste R'||coalesce(l.last_round_no::text,'-')||':'||trim(to_char(coalesce(l.last_round_points,0),'FM999990.00')),
    ' | ' order by l.team_name
  )
  into v_actual
  from get_fantasy_season_leaderboard(v_test_season) l;

  v_ok := v_actual =
    'TEST A · Arctic Owls=snitt 15.00/beste 20.00/siste R3:15.00 | TEST B · Blue Lines=snitt 15.00/beste 20.00/siste R3:10.00 | TEST C · Crossbars=snitt 15.00/beste 20.00/siste R3:15.00 | TEST D · Dump & Chase=snitt 10.00/beste 12.00/siste R3:8.00';

  return query select
    'Snitt + beste + siste runde'::text,
    'Kontrollerte verdier for alle 4 lag'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 4. Round 2 shared winners and dense ranking.
  select r.id into v_round_2
  from fantasy_rounds r
  where r.season=v_test_season and r.round_no=2;

  select string_agg(
    l.team_name||'=#'||l.standings_position||'/'||trim(to_char(l.round_points,'FM999990.00')),
    ' | ' order by l.team_name
  )
  into v_actual
  from get_fantasy_round_leaderboard(v_round_2) l;

  v_ok := v_actual =
    'TEST A · Arctic Owls=#2/10.00 | TEST B · Blue Lines=#1/20.00 | TEST C · Crossbars=#1/20.00 | TEST D · Dump & Chase=#2/10.00';

  return query select
    'Runde 2 delt rundeseier'::text,
    'B/C #1 med 20 · A/D #2 med 10'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 5. Team A history and round positions.
  select t.id into v_team_a
  from fantasy_user_teams t
  where t.season=v_test_season and t.name='TEST A · Arctic Owls';

  select string_agg(
    'R'||h.round_no||'=#'||h.round_position||'/'||trim(to_char(h.round_points,'FM999990.00')),
    ' | ' order by h.round_no
  )
  into v_actual
  from get_fantasy_team_season_history(v_team_a,v_test_season) h;

  v_ok := v_actual='R1=#1/20.00 | R2=#2/10.00 | R3=#1/15.00';

  return query select
    'Rundehistorikk for ett lag'::text,
    'R1 #1/20 · R2 #2/10 · R3 #1/15'::text,
    coalesce(v_actual,'—'),
    v_ok;
end;
$$;

revoke all on function run_fantasy_leaderboard_e2e_test() from public;
grant execute on function run_fantasy_leaderboard_e2e_test() to authenticated;
