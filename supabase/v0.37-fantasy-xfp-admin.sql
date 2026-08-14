-- Stang Inn Fantasy Hockey – v0.37
-- Admin-only expected Fantasy points (xFP) model for 2026/27.
-- Read-only model: no scoring, roster or price data is changed.
--
-- Model v1 deliberately uses only data already present in Stang Inn:
--   * season fantasy points per game (50%)
--   * recent form, last five scored games (30%)
--   * home/away split for the next fixture (10%)
--   * opponent defensive difficulty from goals allowed per game (10%)
-- It also exposes next-3 fixture volume and fixed-price value for downstream tools.

create or replace function get_fantasy_xfp_admin_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  position text,
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
  data_confidence text
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
    select 1 from players p
    where p.id=auth.uid() and p.admin=true
  ) then
    raise exception 'Admin only';
  end if;

  if p_season <> '2026/27' then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;

  return query
  with latest_points as (
    select distinct on (fpp.player_id,fpp.game_id)
      fpp.player_id,
      fpp.game_id,
      fpp.actual_points::numeric as actual_points,
      g.starts_at,
      g.home_team,
      g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where g.season=p_season
    order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ),
  season_form as (
    select
      lp.player_id,
      count(*)::integer as games_scored,
      avg(lp.actual_points)::numeric as season_ppg
    from latest_points lp
    group by lp.player_id
  ),
  ranked_form as (
    select lp.*,
      row_number() over(partition by lp.player_id order by lp.starts_at desc) as rn
    from latest_points lp
  ),
  recent_form as (
    select rf.player_id,avg(rf.actual_points)::numeric as form_ppg
    from ranked_form rf
    where rf.rn<=5
    group by rf.player_id
  ),
  venue_splits as (
    select
      fp.id as player_id,
      avg(lp.actual_points) filter(where lp.home_team=fp.team)::numeric as home_ppg,
      avg(lp.actual_points) filter(where lp.away_team=fp.team)::numeric as away_ppg
    from fantasy_players fp
    left join latest_points lp on lp.player_id=fp.id
    group by fp.id
  ),
  team_defense as (
    select club,
      avg(goals_against)::numeric as goals_against_pg
    from (
      select g.home_team as club,g.away_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season and g.home_score is not null and g.away_score is not null
      union all
      select g.away_team as club,g.home_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season and g.home_score is not null and g.away_score is not null
    ) x
    group by club
  ),
  league_defense as (
    select avg(td.goals_against_pg)::numeric as avg_ga from team_defense td
  ),
  upcoming_ranked as (
    select
      fp.id as player_id,
      g.id as game_id,
      g.starts_at,
      case when g.home_team=fp.team then g.away_team else g.home_team end as opponent,
      (g.home_team=fp.team) as is_home,
      row_number() over(partition by fp.id order by g.starts_at) as rn
    from fantasy_players fp
    join fantasy_games g
      on (g.home_team=fp.team or g.away_team=fp.team)
    where g.season=p_season
      and g.starts_at>now()
      and coalesce(g.status,'scheduled') not in ('finished','cancelled')
  ),
  next_fixture as (
    select ur.player_id,ur.starts_at,ur.opponent,ur.is_home
    from upcoming_ranked ur where ur.rn=1
  ),
  next3 as (
    select ur.player_id,count(*)::integer as games
    from upcoming_ranked ur where ur.rn<=3
    group by ur.player_id
  ),
  base as (
    select
      fp.id as player_id,
      fp.name as player_name,
      fp.team,
      fp.position,
      sp.price::numeric as price,
      coalesce(sf.games_scored,0) as games_scored,
      coalesce(sf.season_ppg,0)::numeric as season_ppg,
      coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,
      coalesce(
        case when nf.is_home then vs.home_ppg else vs.away_ppg end,
        sf.season_ppg,
        0
      )::numeric as venue_ppg,
      nf.opponent,
      nf.starts_at as next_game_at,
      nf.is_home,
      case
        when nf.opponent is null then 1::numeric
        when ld.avg_ga is null or ld.avg_ga=0 then 1::numeric
        when td.goals_against_pg is null then 1::numeric
        else greatest(0.80::numeric,least(1.20::numeric,td.goals_against_pg/ld.avg_ga))
      end::numeric as opponent_factor,
      coalesce(n3.games,0) as next3_games
    from fantasy_players fp
    left join fantasy_player_season_prices sp
      on sp.player_id=fp.id and sp.season=p_season
    left join season_form sf on sf.player_id=fp.id
    left join recent_form rf on rf.player_id=fp.id
    left join venue_splits vs on vs.player_id=fp.id
    left join next_fixture nf on nf.player_id=fp.id
    left join team_defense td on td.club=nf.opponent
    cross join league_defense ld
    left join next3 n3 on n3.player_id=fp.id
    where fp.active=true
      and fp.on_current_roster=true
      and sp.price is not null
  ),
  scored as (
    select b.*,
      case when b.next_game_at is null then 0::numeric else
        (
          0.50*b.season_ppg +
          0.30*b.form_ppg +
          0.10*b.venue_ppg +
          0.10*(b.season_ppg*b.opponent_factor)
        )
      end::numeric as raw_xfp
    from base b
  )
  select
    s.player_id,s.player_name,s.team,s.position,s.price,s.games_scored,
    round(s.season_ppg,2),round(s.form_ppg,2),round(s.venue_ppg,2),
    s.opponent,s.next_game_at,s.is_home,round(s.opponent_factor,3),s.next3_games,
    round(s.raw_xfp,2) as xfp_next_game,
    round(s.raw_xfp*s.next3_games,2) as xfp_next3,
    case when s.price>0 then round((s.raw_xfp*s.next3_games)/s.price,3) else 0::numeric end as value_next3,
    case
      when s.games_scored>=10 then 'high'
      when s.games_scored>=5 then 'medium'
      else 'low'
    end as data_confidence
  from scored s
  order by xfp_next_game desc,s.player_name;
end;
$$;

revoke all on function get_fantasy_xfp_admin_v1(text) from public;
grant execute on function get_fantasy_xfp_admin_v1(text) to authenticated;

comment on function get_fantasy_xfp_admin_v1(text) is
  'Admin-only xFP v1. Weighted season PPG, recent form, venue split and opponent defense; exposes next-3 volume/value. Read-only.';
