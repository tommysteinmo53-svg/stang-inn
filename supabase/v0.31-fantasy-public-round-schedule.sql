-- Stang Inn Fantasy Hockey – v0.31
-- Safe authenticated read model for fantasy round schedules.
-- Returns only fields needed by the player-facing rounds page.

create or replace function get_fantasy_round_schedule_v1(
  p_season text
) returns table(
  game_id uuid,
  fantasy_round_id uuid,
  fantasy_round_no integer,
  starts_at timestamptz,
  home_team text,
  away_team text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    g.id,
    g.fantasy_round_id,
    r.round_no,
    g.starts_at,
    g.home_team,
    g.away_team
  from fantasy_games g
  join fantasy_rounds r on r.id=g.fantasy_round_id
  where g.season=p_season
    and r.season=p_season
    and r.round_no<9000
  order by r.round_no,g.starts_at,g.home_team,g.away_team;
end;
$$;

revoke all on function get_fantasy_round_schedule_v1(text) from public;
grant execute on function get_fantasy_round_schedule_v1(text) to authenticated;
