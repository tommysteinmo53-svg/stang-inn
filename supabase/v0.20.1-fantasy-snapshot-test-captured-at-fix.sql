-- Stang Inn Fantasy Hockey – v0.20.1
-- Fix ambiguous captured_at reference in snapshot E2E test state function.

create or replace function get_fantasy_snapshot_test_state(
  p_season text default '2026/27'
)
returns table(
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

  select t.id into v_team_id
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season;

  select r.id into v_round_id
  from fantasy_rounds r
  where r.season=p_season and r.round_no=9999;

  if v_round_id is not null and v_team_id is not null then
    select s.id,s.captured_at into v_snapshot_id,v_captured
    from fantasy_team_round_snapshots s
    where s.round_id=v_round_id and s.team_id=v_team_id;
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
