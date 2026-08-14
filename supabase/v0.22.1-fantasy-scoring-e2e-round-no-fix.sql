-- Stang Inn Fantasy Hockey – v0.22.1
-- Fix PL/pgSQL ambiguity between RETURNS TABLE round_no and fantasy_rounds.round_no.
-- Safe to run after v0.22. Only replaces the fixture-creation function.

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
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists(
    select 1
    from players p
    where p.id=v_user
      and coalesce(p.admin,false)
  ) then
    raise exception 'Admin access required';
  end if;

  select t.*
  into v_team
  from fantasy_user_teams t
  where t.user_id=v_user
    and t.season=p_season;

  if not found then
    raise exception 'No fantasy team found for season %',p_season;
  end if;

  if (
    select count(*)
    from fantasy_user_team_players tp
    where tp.team_id=v_team.id
  ) <> 12 then
    raise exception 'Test requires a complete 12-player live team';
  end if;

  select tp.player_id
  into v_cap
  from fantasy_user_team_players tp
  where tp.team_id=v_team.id
    and tp.is_captain
  limit 1;

  select tp.player_id
  into v_vice
  from fantasy_user_team_players tp
  where tp.team_id=v_team.id
    and tp.is_vice_captain
  limit 1;

  if v_cap is null or v_vice is null then
    raise exception 'Test requires captain and vice-captain';
  end if;

  select tp.player_id
  into v_other
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

  -- Clean only our isolated test fixtures.
  delete from fantasy_games g
  where g.season=p_season
    and g.external_id in ('test:scoring-e2e:A','test:scoring-e2e:B');

  -- IMPORTANT: qualify round_no because RETURNS TABLE also defines a PL/pgSQL
  -- output variable named round_no.
  delete from fantasy_rounds r
  where r.season=p_season
    and r.round_no in (9997,9998);

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
    'test:scoring-e2e:A',p_season,9997,now()-interval '2 hours',
    'TEST HOME','TEST AWAY','finished',v_round_a,now()
  ) returning id into v_game_a;

  insert into fantasy_games(
    external_id,season,round_no,starts_at,home_team,away_team,status,fantasy_round_id,updated_at
  ) values(
    'test:scoring-e2e:B',p_season,9998,now()-interval '2 hours',
    'TEST HOME','TEST AWAY','finished',v_round_b,now()
  ) returning id into v_game_b;

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
  select
    v_snap_a,fp.id,fp.position,fp.team,tp.purchase_price,
    tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  insert into fantasy_team_round_snapshot_players(
    snapshot_id,player_id,position,team,price,is_captain,is_vice_captain
  )
  select
    v_snap_b,fp.id,fp.position,fp.team,tp.purchase_price,
    tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  -- Scenario A: captain 10 FP, vice 7 FP, other 3 FP.
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

  -- Scenario B: captain has no stat row; vice 7 FP, other 3 FP.
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
  select
    'A · kaptein spiller'::text,
    v_round_a,
    9997,
    v_game_a,
    v_snap_a,
    v_cap,
    v_vice,
    v_other,
    20::numeric,
    10::numeric,
    0::numeric,
    30::numeric
  union all
  select
    'B · visekaptein overtar'::text,
    v_round_b,
    9998,
    v_game_b,
    v_snap_b,
    v_cap,
    v_vice,
    v_other,
    10::numeric,
    0::numeric,
    7::numeric,
    17::numeric;
end;
$$;

revoke all on function create_fantasy_scoring_e2e_test(text) from public;
grant execute on function create_fantasy_scoring_e2e_test(text) to authenticated;
