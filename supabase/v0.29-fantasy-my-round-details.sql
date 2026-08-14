-- Stang Inn Fantasy Hockey – v0.29
-- Authenticated read model for a user's own scored fantasy rounds.
-- Uses stored immutable round/team/player scoring rows only.

create or replace function get_my_fantasy_round_details_v1(
  p_season text,
  p_round_id uuid default null
) returns table(
  round_id uuid,
  round_no integer,
  round_name text,
  deadline_at timestamptz,
  team_round_points_id uuid,
  team_id uuid,
  team_name text,
  base_points numeric,
  captain_bonus numeric,
  vice_captain_bonus numeric,
  round_points numeric,
  calculated_at timestamptz,
  player_id uuid,
  player_name text,
  player_position text,
  player_team text,
  is_captain boolean,
  is_vice_captain boolean,
  played boolean,
  games_played integer,
  raw_points numeric,
  multiplier numeric,
  bonus_points numeric,
  player_total_points numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    r.id,
    r.round_no,
    r.name,
    r.deadline_at,
    trp.id,
    trp.team_id,
    s.team_name,
    trp.base_points::numeric,
    trp.captain_bonus::numeric,
    trp.vice_captain_bonus::numeric,
    trp.total_points::numeric,
    trp.calculated_at,
    prp.player_id,
    prp.player_name,
    prp.position,
    prp.team,
    prp.is_captain,
    prp.is_vice_captain,
    prp.played,
    prp.games_played,
    prp.raw_points::numeric,
    prp.multiplier::numeric,
    prp.bonus_points::numeric,
    prp.total_points::numeric
  from fantasy_team_round_points trp
  join fantasy_rounds r on r.id=trp.round_id
  join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  join fantasy_team_round_player_points prp on prp.team_round_points_id=trp.id
  where trp.user_id=v_user
    and trp.season=p_season
    and r.season=p_season
    and r.round_no<9000
    and (p_round_id is null or r.id=p_round_id)
  order by
    r.round_no desc,
    case when prp.position='G' then 0 when prp.position='D' then 1 else 2 end,
    prp.player_name;
end;
$$;

revoke all on function get_my_fantasy_round_details_v1(text,uuid) from public;
grant execute on function get_my_fantasy_round_details_v1(text,uuid) to authenticated;
