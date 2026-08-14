-- Stang Inn Fantasy Hockey – v0.26
-- Isolated admin-only E2E test for monthly winners, streaks and expert titles.
-- Uses a dedicated test season so real 2026/27 data is never touched.

create or replace function cleanup_fantasy_achievements_e2e_test()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_deleted integer:=0;
  v_rows integer:=0;
  v_test_season constant text:='TEST-v0.26-achievements';
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  delete from fantasy_user_teams t where t.season=v_test_season;
  get diagnostics v_rows=row_count;
  v_deleted:=v_deleted+v_rows;

  delete from fantasy_rounds r where r.season=v_test_season;
  get diagnostics v_rows=row_count;
  v_deleted:=v_deleted+v_rows;

  return v_deleted;
end;
$$;

revoke all on function cleanup_fantasy_achievements_e2e_test() from public;
grant execute on function cleanup_fantasy_achievements_e2e_test() to authenticated;


create or replace function create_fantasy_achievements_e2e_test()
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
  v_test_season constant text:='TEST-v0.26-achievements';
  v_i integer;
  v_round_no integer;
  v_round_id uuid;
  v_deadline timestamptz;
  v_team_id uuid;
  v_score numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  delete from fantasy_user_teams t where t.season=v_test_season;
  delete from fantasy_rounds r where r.season=v_test_season;

  -- 20 teams are needed so title thresholds can exercise top 10% and top 25%.
  for v_i in 1..20 loop
    insert into fantasy_user_teams(user_id,season,name,budget,created_at,updated_at)
    values(
      gen_random_uuid(),
      v_test_season,
      'TEST '||lpad(v_i::text,2,'0')||' · Achievement Club',
      100,
      now(),
      now()
    );
  end loop;

  -- Four scored rounds: two in September and two in October.
  for v_round_no in 1..4 loop
    v_deadline := case v_round_no
      when 1 then '2026-09-20 18:00:00+02'::timestamptz
      when 2 then '2026-09-27 18:00:00+02'::timestamptz
      when 3 then '2026-10-04 18:00:00+02'::timestamptz
      else '2026-10-11 18:00:00+02'::timestamptz
    end;

    insert into fantasy_rounds(
      season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at
    ) values(
      v_test_season,
      v_round_no,
      'TEST Achievement Runde '||v_round_no,
      v_deadline + interval '1 hour',
      v_deadline,
      v_deadline + interval '4 hours',
      'finished',
      now(),
      now()
    ) returning id into v_round_id;

    insert into fantasy_team_round_snapshots(
      round_id,team_id,user_id,season,team_name,squad_value,captured_at
    )
    select
      v_round_id,t.id,t.user_id,v_test_season,t.name,100,v_deadline
    from fantasy_user_teams t
    where t.season=v_test_season;

    -- Baseline: lower team number scores higher.
    -- Special cases shape monthly winners and streak behaviour.
    for v_i in 1..20 loop
      select t.id into v_team_id
      from fantasy_user_teams t
      where t.season=v_test_season
        and t.name='TEST '||lpad(v_i::text,2,'0')||' · Achievement Club';

      v_score := 100-v_i;

      -- September winner: team 01 (R1+R2 strongest).
      if v_round_no in (1,2) and v_i=1 then v_score:=120; end if;
      if v_round_no in (1,2) and v_i=2 then v_score:=110; end if;

      -- October winner: team 02 (R3+R4 strongest).
      if v_round_no in (3,4) and v_i=2 then v_score:=130; end if;
      if v_round_no in (3,4) and v_i=1 then v_score:=105; end if;

      -- Team 20 is deliberately top-half in R1/R2, bottom-half in R3/R4:
      -- longest streak 2, current streak 0.
      if v_i=20 and v_round_no in (1,2) then v_score:=108; end if;
      if v_i=20 and v_round_no in (3,4) then v_score:=1; end if;

      insert into fantasy_team_round_points(
        snapshot_id,round_id,team_id,user_id,season,
        base_points,captain_bonus,vice_captain_bonus,total_points,
        calculation_version,calculated_at
      )
      select
        s.id,s.round_id,s.team_id,s.user_id,v_test_season,
        v_score,0,0,v_score,'test-v0.26',now()
      from fantasy_team_round_snapshots s
      where s.round_id=v_round_id and s.team_id=v_team_id;
    end loop;
  end loop;

  return query
  select
    v_test_season,
    (select count(*)::integer from fantasy_user_teams t where t.season=v_test_season),
    (select count(*)::integer from fantasy_rounds r where r.season=v_test_season),
    (select count(*)::integer from fantasy_team_round_points trp where trp.season=v_test_season);
end;
$$;

revoke all on function create_fantasy_achievements_e2e_test() from public;
grant execute on function create_fantasy_achievements_e2e_test() to authenticated;


create or replace function run_fantasy_achievements_e2e_test()
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
  v_test_season constant text:='TEST-v0.26-achievements';
  v_actual text;
  v_ok boolean;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  if (select count(*) from fantasy_user_teams t where t.season=v_test_season)<>20 then
    raise exception 'Achievements test fixture is missing. Create it first.';
  end if;

  -- 1. Monthly winners.
  select string_agg(
    m.month_key||'='||m.team_name||'/'||trim(to_char(m.monthly_points,'FM999990.00')),
    ' | ' order by m.month_key
  )
  into v_actual
  from get_fantasy_monthly_leaderboard(v_test_season) m
  where m.standings_position=1;

  v_ok := v_actual =
    '2026-09=TEST 01 · Achievement Club/240.00 | 2026-10=TEST 02 · Achievement Club/260.00';

  return query select
    'Månedsvinnere'::text,
    'September: TEST 01 med 240 · Oktober: TEST 02 med 260'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 2. Streak for team 20: two good rounds followed by two bad rounds.
  select
    'nå '||s.current_streak||'/rekord '||s.longest_streak||'/siste R'||coalesce(s.latest_round_no::text,'-')||'/god '||s.latest_round_in_streak
  into v_actual
  from get_fantasy_team_streaks(v_test_season) s
  where s.team_name='TEST 20 · Achievement Club';

  v_ok := v_actual='nå 0/rekord 2/siste R4/god false';

  return query select
    'Streak brytes korrekt'::text,
    'TEST 20: nå 0 · rekord 2 · siste R4 ikke i streak'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 3. Team 02 should currently have a 4-round top-half streak.
  select
    'nå '||s.current_streak||'/rekord '||s.longest_streak
  into v_actual
  from get_fantasy_team_streaks(v_test_season) s
  where s.team_name='TEST 02 · Achievement Club';

  v_ok := v_actual='nå 4/rekord 4';

  return query select
    'Aktiv streak'::text,
    'TEST 02: nå 4 · rekord 4'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 4. Expert title distribution. With 20 teams: #1 expert, #2 top-10 taktiker,
  -- #3-#5 top-25 analytiker, remaining teams utfordrer.
  select string_agg(
    e.standings_position||'='||e.expert_icon||' '||e.expert_title,
    ' | ' order by e.standings_position
  )
  into v_actual
  from get_fantasy_expert_titles(v_test_season) e
  where e.standings_position in (1,2,3,6);

  v_ok := v_actual =
    '1=👑 Fantasy-ekspert | 2=🧠 Taktiker | 3=📈 Analytiker | 6=🏒 Utfordrer';

  return query select
    'Eksperttitler etter plassering'::text,
    '#1 ekspert · #2 taktiker · #3 analytiker · #6 utfordrer'::text,
    coalesce(v_actual,'—'),
    v_ok;

  -- 5. Achievement summary must agree with title + streak functions for team 02.
  select
    a.expert_icon||' '||a.expert_title||'/nå '||a.current_streak||'/rekord '||a.longest_streak
  into v_actual
  from get_fantasy_team_achievements(v_test_season) a
  join fantasy_user_teams t on t.id=a.team_id
  where t.name='TEST 02 · Achievement Club';

  v_ok := v_actual is not null and v_actual like '%/nå 4/rekord 4';

  return query select
    'Achievement-sammendrag'::text,
    'TEST 02 har samme tittel/streak i samlet funksjon'::text,
    coalesce(v_actual,'—'),
    v_ok;
end;
$$;

revoke all on function run_fantasy_achievements_e2e_test() from public;
grant execute on function run_fantasy_achievements_e2e_test() to authenticated;
