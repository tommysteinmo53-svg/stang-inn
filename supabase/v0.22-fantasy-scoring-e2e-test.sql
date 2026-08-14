-- Stang Inn Fantasy Hockey – v0.22
-- Admin-only end-to-end tests for team round scoring.
-- Scenario A proves captain multiplier when captain plays.
-- Scenario B proves vice-captain fallback when captain does not play.
-- Uses isolated rounds 9997/9998 and isolated test games; cleanup removes everything.

create or replace function cleanup_fantasy_scoring_e2e_test(
  p_season text default '2026/27'
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_deleted integer := 0;
  v_rows integer := 0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  -- Deleting games cascades test stats and fantasy_player_points.
  delete from fantasy_games
  where season=p_season
    and external_id in ('test:scoring-e2e:A','test:scoring-e2e:B');
  get diagnostics v_rows=row_count;
  v_deleted:=v_deleted+v_rows;

  -- Deleting rounds cascades snapshots, snapshot players and stored team-round scores.
  delete from fantasy_rounds
  where season=p_season
    and round_no in (9997,9998);
  get diagnostics v_rows=row_count;
  v_deleted:=v_deleted+v_rows;

  return v_deleted;
end;
$$;

revoke all on function cleanup_fantasy_scoring_e2e_test(text) from public;
grant execute on function cleanup_fantasy_scoring_e2e_test(text) to authenticated;


create or replace function create_fantasy_scoring_e2e_test(
  p_season text default '2026/27'
)
returns table(
  scenario_name text,
  round_id uuid,
  round_no integer,
  game_id uuid,
  snapshot_id uuid,
  captain_id uuid,
  vice_captain_id uuid,
  other_player_id uuid,
  expected_base_points numeric,
  expected_captain_bonus numeric,
  expected_vice_bonus numeric,
  expected_total_points numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team fantasy_user_teams%rowtype;
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
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select * into v_team
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season;
  if not found then raise exception 'No fantasy team found for season %',p_season; end if;

  if (select count(*) from fantasy_user_team_players tp where tp.team_id=v_team.id)<>12 then
    raise exception 'Test requires a complete 12-player live team';
  end if;

  select tp.player_id into v_cap
  from fantasy_user_team_players tp
  where tp.team_id=v_team.id and tp.is_captain
  limit 1;

  select tp.player_id into v_vice
  from fantasy_user_team_players tp
  where tp.team_id=v_team.id and tp.is_vice_captain
  limit 1;

  if v_cap is null or v_vice is null then
    raise exception 'Test requires captain and vice-captain';
  end if;

  select tp.player_id into v_other
  from fantasy_user_team_players tp
  where tp.team_id=v_team.id
    and tp.player_id<>v_cap
    and tp.player_id<>v_vice
  order by tp.player_id
  limit 1;

  select coalesce(sum(tp.purchase_price),0)
  into v_value
  from fantasy_user_team_players tp
  where tp.team_id=v_team.id;

  -- Start from a clean isolated fixture. Inline cleanup avoids nested auth surprises.
  delete from fantasy_games
  where season=p_season
    and external_id in ('test:scoring-e2e:A','test:scoring-e2e:B');

  delete from fantasy_rounds
  where season=p_season
    and round_no in (9997,9998);

  insert into fantasy_rounds(
    season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at
  ) values(
    p_season,9997,'TEST · Scoring A · Captain plays',
    now()-interval '2 hours',now()-interval '3 hours',now()-interval '1 hour','finished',now(),now()
  ) returning id into v_round_a;

  insert into fantasy_rounds(
    season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at
  ) values(
    p_season,9998,'TEST · Scoring B · Vice fallback',
    now()-interval '2 hours',now()-interval '3 hours',now()-interval '1 hour','finished',now(),now()
  ) returning id into v_round_b;

  insert into fantasy_games(
    external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id,updated_at
  ) values(
    'test:scoring-e2e:A',p_season,9997,now()-interval '2 hours','TEST HOME','TEST AWAY','finished',v_round_a,now()
  ) returning id into v_game_a;

  insert into fantasy_games(
    external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id,updated_at
  ) values(
    'test:scoring-e2e:B',p_season,9998,now()-interval '2 hours','TEST HOME','TEST AWAY','finished',v_round_b,now()
  ) returning id into v_game_b;

  -- Freeze the same current live team into both isolated rounds.
  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at
  ) values(
    v_round_a,v_team.id,v_user,p_season,v_team.name,v_value,now()
  ) returning id into v_snap_a;

  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at
  ) values(
    v_round_b,v_team.id,v_user,p_season,v_team.name,v_value,now()
  ) returning id into v_snap_b;

  insert into fantasy_team_round_snapshot_players(
    snapshot_id,player_id,position,team,price,is_captain,is_vice_captain
  )
  select v_snap_a,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  insert into fantasy_team_round_snapshot_players(
    snapshot_id,player_id,position,team,price,is_captain,is_vice_captain
  )
  select v_snap_b,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  -- Scenario A: captain plays (10 FP), vice plays (7 FP), one other player gets 3 FP.
  insert into fantasy_player_game_stats(player_id,game_id,raw)
  values
    (v_cap,v_game_a,'{"test":"v0.22","scenario":"A","role":"captain"}'::jsonb),
    (v_vice,v_game_a,'{"test":"v0.22","scenario":"A","role":"vice"}'::jsonb),
    (v_other,v_game_a,'{"test":"v0.22","scenario":"A","role":"other"}'::jsonb);

  insert into fantasy_player_points(
    player_id,game_id,actual_points,calculation_version,breakdown,calculated_at
  ) values
    (v_cap,v_game_a,10,'test-v0.22','{"test":true,"scenario":"A"}'::jsonb,now()),
    (v_vice,v_game_a,7,'test-v0.22','{"test":true,"scenario":"A"}'::jsonb,now()),
    (v_other,v_game_a,3,'test-v0.22','{"test":true,"scenario":"A"}'::jsonb,now());

  -- Scenario B: captain has NO stat row. Vice plays (7 FP), one other gets 3 FP.
  insert into fantasy_player_game_stats(player_id,game_id,raw)
  values
    (v_vice,v_game_b,'{"test":"v0.22","scenario":"B","role":"vice"}'::jsonb),
    (v_other,v_game_b,'{"test":"v0.22","scenario":"B","role":"other"}'::jsonb);

  insert into fantasy_player_points(
    player_id,game_id,actual_points,calculation_version,breakdown,calculated_at
  ) values
    (v_vice,v_game_b,7,'test-v0.22','{"test":true,"scenario":"B"}'::jsonb,now()),
    (v_other,v_game_b,3,'test-v0.22','{"test":true,"scenario":"B"}'::jsonb,now());

  return query
  select 'A · kaptein spiller'::text,v_round_a,9997,v_game_a,v_snap_a,v_cap,v_vice,v_other,
         20::numeric,10::numeric,0::numeric,30::numeric
  union all
  select 'B · visekaptein overtar'::text,v_round_b,9998,v_game_b,v_snap_b,v_cap,v_vice,v_other,
         10::numeric,0::numeric,7::numeric,17::numeric;
end;
$$;

revoke all on function create_fantasy_scoring_e2e_test(text) from public;
grant execute on function create_fantasy_scoring_e2e_test(text) to authenticated;


create or replace function run_fantasy_scoring_e2e_test(
  p_season text default '2026/27'
)
returns table(
  scenario_name text,
  round_no integer,
  expected_base_points numeric,
  actual_base_points numeric,
  expected_captain_bonus numeric,
  actual_captain_bonus numeric,
  expected_vice_bonus numeric,
  actual_vice_bonus numeric,
  expected_total_points numeric,
  actual_total_points numeric,
  player_rows bigint,
  passed boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round_a uuid;
  v_round_b uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select r.id into v_round_a from fantasy_rounds r where r.season=p_season and r.round_no=9997;
  select r.id into v_round_b from fantasy_rounds r where r.season=p_season and r.round_no=9998;

  if v_round_a is null or v_round_b is null then
    raise exception 'Scoring test fixture is missing. Create it first.';
  end if;

  perform * from calculate_fantasy_round_team_points(v_round_a);
  perform * from calculate_fantasy_round_team_points(v_round_b);

  return query
  with expected as (
    select v_round_a as rid,'A · kaptein spiller'::text as label,9997 as rno,
           20::numeric as ebase,10::numeric as ecap,0::numeric as evice,30::numeric as etotal
    union all
    select v_round_b,'B · visekaptein overtar'::text,9998,
           10::numeric,0::numeric,7::numeric,17::numeric
  ), actual as (
    select trp.round_id,trp.base_points,trp.captain_bonus,trp.vice_captain_bonus,trp.total_points,
           count(prp.id)::bigint as prow
    from fantasy_team_round_points trp
    left join fantasy_team_round_player_points prp on prp.team_round_points_id=trp.id
    where trp.round_id in (v_round_a,v_round_b)
      and trp.user_id=v_user
    group by trp.id
  )
  select e.label,e.rno,e.ebase,a.base_points,e.ecap,a.captain_bonus,e.evice,a.vice_captain_bonus,
         e.etotal,a.total_points,coalesce(a.prow,0),
         (a.base_points=e.ebase
          and a.captain_bonus=e.ecap
          and a.vice_captain_bonus=e.evice
          and a.total_points=e.etotal
          and a.prow=12) as passed
  from expected e
  left join actual a on a.round_id=e.rid
  order by e.rno;
end;
$$;

revoke all on function run_fantasy_scoring_e2e_test(text) from public;
grant execute on function run_fantasy_scoring_e2e_test(text) to authenticated;
