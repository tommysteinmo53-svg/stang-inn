-- Stang Inn Fantasy Hockey – v0.38
-- Admin-only recommendation data layer for 2026/27.
-- Read-only. Adds ownership to the existing configurable xFP model.

create or replace function get_fantasy_recommendation_data_admin_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  price numeric,
  games_scored integer,
  season_ppg numeric,
  form_ppg numeric,
  venue_ppg numeric,
  opponent text,
  next_game_at timestamptz,
  is_home boolean,
  opponent_factor numeric,
  next3_games integer,
  xfp_next_game numeric,
  xfp_next3 numeric,
  value_next3 numeric,
  data_confidence text,
  ownership_percent numeric,
  owner_teams integer,
  total_teams integer
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

  if not exists(
    select 1
    from players p
    where p.id=auth.uid()
      and p.admin=true
  ) then
    raise exception 'Admin only';
  end if;

  if p_season <> '2026/27' then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;

  return query
  with xfp as (
    select *
    from get_fantasy_xfp_admin_v1(p_season)
  ),
  team_count as (
    select count(*)::integer as total_teams
    from fantasy_user_teams t
    where t.season=p_season
  ),
  ownership as (
    select
      tp.player_id,
      count(distinct tp.team_id)::integer as owner_teams
    from fantasy_user_team_players tp
    join fantasy_user_teams t
      on t.id=tp.team_id
    where t.season=p_season
    group by tp.player_id
  )
  select
    x.player_id,
    x.player_name,
    x.team,
    x.player_position,
    x.price,
    x.games_scored,
    x.season_ppg,
    x.form_ppg,
    x.venue_ppg,
    x.opponent,
    x.next_game_at,
    x.is_home,
    x.opponent_factor,
    x.next3_games,
    x.xfp_next_game,
    x.xfp_next3,
    x.value_next3,
    x.data_confidence,
    case
      when tc.total_teams=0 then 0::numeric
      else round(
        coalesce(o.owner_teams,0)::numeric
        / tc.total_teams::numeric
        * 100,
        1
      )
    end as ownership_percent,
    coalesce(o.owner_teams,0)::integer as owner_teams,
    tc.total_teams
  from xfp x
  cross join team_count tc
  left join ownership o
    on o.player_id=x.player_id
  order by x.xfp_next_game desc,x.player_name;
end;
$$;

revoke all
on function get_fantasy_recommendation_data_admin_v1(text)
from public;

grant execute
on function get_fantasy_recommendation_data_admin_v1(text)
to authenticated;

comment on function get_fantasy_recommendation_data_admin_v1(text) is
  'Admin-only recommendation dataset combining configurable xFP with real Fantasy ownership. Read-only.';
