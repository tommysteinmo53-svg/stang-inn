-- Stang Inn Fantasy Hockey – v0.20
-- Admin-only end-to-end snapshot test harness.
-- Creates one temporary due round (9999) in the real season so save_fantasy_team_v3
-- exercises the same pre-edit freezing path used in production.
-- Cleanup removes both the test snapshot and test round completely.

create or replace function create_fantasy_snapshot_test_round(
  p_season text default '2026/27'
) returns table(
  test_round_id uuid,
  test_round_no integer,
  deadline_at timestamptz,
  snapshot_exists boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round_id uuid;
  v_deadline timestamptz := now() - interval '5 minutes';
  v_team_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select id into v_team_id
  from fantasy_user_teams
  where user_id=v_user and season=p_season;
  if v_team_id is null then raise exception 'No fantasy team found for season %',p_season; end if;

  -- Always start clean for this admin user/test round.
  delete from fantasy_team_round_snapshots s
  using fantasy_rounds r
  where s.round_id=r.id
    and r.season=p_season
    and r.round_no=9999
    and s.team_id=v_team_id;

  delete from fantasy_rounds
  where season=p_season and round_no=9999;

  insert into fantasy_rounds(
    season,round_no,name,starts_at,deadline_at,ends_at,status,created_at,updated_at
  ) values(
    p_season,9999,'TEST · Snapshot E2E',
    v_deadline,v_deadline,now()+interval '1 hour','locked',now(),now()
  ) returning id into v_round_id;

  return query
  select v_round_id,9999,v_deadline,false;
end;
$$;

revoke all on function create_fantasy_snapshot_test_round(text) from public;
grant execute on function create_fantasy_snapshot_test_round(text) to authenticated;

create or replace function get_fantasy_snapshot_test_state(
  p_season text default '2026/27'
) returns table(
  test_round_id uuid,
  test_round_exists boolean,
  snapshot_id uuid,
  snapshot_exists boolean,
  snapshot_player_count bigint,
  live_player_count bigint,
  same_player_set boolean,
  snapshot_captain uuid,
  live_captain uuid,
  same_captain boolean,
  snapshot_vice_captain uuid,
  live_vice_captain uuid,
  same_vice_captain boolean,
  captured_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team_id uuid;
  v_round_id uuid;
  v_snapshot_id uuid;
  v_captured timestamptz;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select id into v_team_id
  from fantasy_user_teams
  where user_id=v_user and season=p_season;

  select id into v_round_id
  from fantasy_rounds
  where season=p_season and round_no=9999;

  if v_round_id is not null and v_team_id is not null then
    select id,captured_at into v_snapshot_id,v_captured
    from fantasy_team_round_snapshots
    where round_id=v_round_id and team_id=v_team_id;
  end if;

  return query
  select
    v_round_id,
    (v_round_id is not null),
    v_snapshot_id,
    (v_snapshot_id is not null),
    (select count(*)::bigint from fantasy_team_round_snapshot_players sp where sp.snapshot_id=v_snapshot_id),
    (select count(*)::bigint from fantasy_user_team_players tp where tp.team_id=v_team_id),
    case when v_snapshot_id is null then false else
      not exists(
        (select sp.player_id from fantasy_team_round_snapshot_players sp where sp.snapshot_id=v_snapshot_id
         except
         select tp.player_id from fantasy_user_team_players tp where tp.team_id=v_team_id)
        union all
        (select tp.player_id from fantasy_user_team_players tp where tp.team_id=v_team_id
         except
         select sp.player_id from fantasy_team_round_snapshot_players sp where sp.snapshot_id=v_snapshot_id)
      )
    end,
    (select sp.player_id from fantasy_team_round_snapshot_players sp where sp.snapshot_id=v_snapshot_id and sp.is_captain limit 1),
    (select tp.player_id from fantasy_user_team_players tp where tp.team_id=v_team_id and tp.is_captain limit 1),
    ((select sp.player_id from fantasy_team_round_snapshot_players sp where sp.snapshot_id=v_snapshot_id and sp.is_captain limit 1)
      is not distinct from
     (select tp.player_id from fantasy_user_team_players tp where tp.team_id=v_team_id and tp.is_captain limit 1)),
    (select sp.player_id from fantasy_team_round_snapshot_players sp where sp.snapshot_id=v_snapshot_id and sp.is_vice_captain limit 1),
    (select tp.player_id from fantasy_user_team_players tp where tp.team_id=v_team_id and tp.is_vice_captain limit 1),
    ((select sp.player_id from fantasy_team_round_snapshot_players sp where sp.snapshot_id=v_snapshot_id and sp.is_vice_captain limit 1)
      is not distinct from
     (select tp.player_id from fantasy_user_team_players tp where tp.team_id=v_team_id and tp.is_vice_captain limit 1)),
    v_captured;
end;
$$;

revoke all on function get_fantasy_snapshot_test_state(text) from public;
grant execute on function get_fantasy_snapshot_test_state(text) to authenticated;

create or replace function cleanup_fantasy_snapshot_test_round(
  p_season text default '2026/27'
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round_id uuid;
  v_deleted integer := 0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select id into v_round_id
  from fantasy_rounds
  where season=p_season and round_no=9999;

  if v_round_id is null then return 0; end if;

  -- Cascade removes snapshot + snapshot players. No real games ever point to this round.
  delete from fantasy_rounds where id=v_round_id;
  get diagnostics v_deleted=row_count;
  return v_deleted;
end;
$$;

revoke all on function cleanup_fantasy_snapshot_test_round(text) from public;
grant execute on function cleanup_fantasy_snapshot_test_round(text) to authenticated;
