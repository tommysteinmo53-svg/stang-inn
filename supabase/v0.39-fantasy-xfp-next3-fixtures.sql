-- Stang Inn Fantasy Hockey – v0.39
-- Improve xFP next-3 forecast by calculating every upcoming fixture separately.
-- Keeps the public return shape of get_fantasy_xfp_admin_v1 unchanged so existing
-- admin UI, recommendation engine and price assessment continue to work.
-- Read-only analysis: no Fantasy scoring, roster or fixed-price data is changed.

create or replace function get_fantasy_xfp_admin_v1(
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
  data_confidence text
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_season_weight numeric;
  v_form_weight numeric;
  v_venue_weight numeric;
  v_opponent_weight numeric;
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

  select
    s.season_weight,
    s.form_weight,
    s.venue_weight,
    s.opponent_weight
  into
    v_season_weight,
    v_form_weight,
    v_venue_weight,
    v_opponent_weight
  from fantasy_xfp_settings s
  where s.season=p_season;

  if not found then
    raise exception 'xFP settings missing for season %',p_season;
  end if;

  return query
  with latest_points as (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,
      fpp.game_id,
      fpp.actual_points::numeric as actual_points,
      g.starts_at,
      g.home_team,
      g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where g.season=p_season
    order by
      fpp.player_id,
      fpp.game_id,
      fpp.calculated_at desc,
      fpp.id desc
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
    select
      lp.*,
      row_number() over(
        partition by lp.player_id
        order by lp.starts_at desc
      ) as rn
    from latest_points lp
  ),

  recent_form as (
    select
      rf.player_id,
      avg(rf.actual_points)::numeric as form_ppg
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
    select
      club,
      avg(goals_against)::numeric as goals_against_pg
    from (
      select
        g.home_team as club,
        g.away_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season
        and g.home_score is not null
        and g.away_score is not null

      union all

      select
        g.away_team as club,
        g.home_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season
        and g.home_score is not null
        and g.away_score is not null
    ) x
    group by club
  ),

  league_defense as (
    select avg(td.goals_against_pg)::numeric as avg_ga
    from team_defense td
  ),

  upcoming_ranked as (
    select
      fp.id as player_id,
      g.id as game_id,
      g.starts_at,
      case
        when g.home_team=fp.team then g.away_team
        else g.home_team
      end as opponent,
      (g.home_team=fp.team) as is_home,
      row_number() over(
        partition by fp.id
        order by g.starts_at,g.id
      ) as rn
    from fantasy_players fp
    join fantasy_games g
      on g.home_team=fp.team
      or g.away_team=fp.team
    where g.season=p_season
      and g.starts_at>now()
      and coalesce(g.status,'scheduled') not in('finished','cancelled')
  ),

  fixture_components as (
    select
      ur.player_id,
      ur.game_id,
      ur.starts_at,
      ur.opponent,
      ur.is_home,
      ur.rn,
      coalesce(sf.season_ppg,0)::numeric as season_ppg,
      coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,
      coalesce(
        case
          when ur.is_home then vs.home_ppg
          else vs.away_ppg
        end,
        sf.season_ppg,
        0
      )::numeric as fixture_venue_ppg,
      case
        when ld.avg_ga is null or ld.avg_ga=0 then 1::numeric
        when td.goals_against_pg is null then 1::numeric
        else greatest(
          0.80::numeric,
          least(
            1.20::numeric,
            td.goals_against_pg/ld.avg_ga
          )
        )
      end::numeric as fixture_opponent_factor
    from upcoming_ranked ur
    left join season_form sf on sf.player_id=ur.player_id
    left join recent_form rf on rf.player_id=ur.player_id
    left join venue_splits vs on vs.player_id=ur.player_id
    left join team_defense td on td.club=ur.opponent
    cross join league_defense ld
    where ur.rn<=3
  ),

  fixture_xfp as (
    select
      fc.*,
      (
        v_season_weight*fc.season_ppg
        + v_form_weight*fc.form_ppg
        + v_venue_weight*fc.fixture_venue_ppg
        + v_opponent_weight*(fc.season_ppg*fc.fixture_opponent_factor)
      )::numeric as fixture_xfp
    from fixture_components fc
  ),

  next_fixture as (
    select
      fx.player_id,
      fx.starts_at,
      fx.opponent,
      fx.is_home,
      fx.fixture_venue_ppg as venue_ppg,
      fx.fixture_opponent_factor as opponent_factor,
      fx.fixture_xfp as xfp_next_game
    from fixture_xfp fx
    where fx.rn=1
  ),

  next3_summary as (
    select
      fx.player_id,
      count(*)::integer as next3_games,
      sum(fx.fixture_xfp)::numeric as xfp_next3
    from fixture_xfp fx
    group by fx.player_id
  ),

  base as (
    select
      fp.id as player_id,
      fp.name as player_name,
      fp.team,
      fp.position as player_position,
      sp.price::numeric as price,
      coalesce(sf.games_scored,0) as games_scored,
      coalesce(sf.season_ppg,0)::numeric as season_ppg,
      coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,
      coalesce(nf.venue_ppg,sf.season_ppg,0)::numeric as venue_ppg,
      nf.opponent,
      nf.starts_at as next_game_at,
      nf.is_home,
      coalesce(nf.opponent_factor,1)::numeric as opponent_factor,
      coalesce(n3.next3_games,0) as next3_games,
      coalesce(nf.xfp_next_game,0)::numeric as xfp_next_game,
      coalesce(n3.xfp_next3,0)::numeric as xfp_next3
    from fantasy_players fp
    left join fantasy_player_season_prices sp
      on sp.player_id=fp.id
      and sp.season=p_season
    left join season_form sf on sf.player_id=fp.id
    left join recent_form rf on rf.player_id=fp.id
    left join next_fixture nf on nf.player_id=fp.id
    left join next3_summary n3 on n3.player_id=fp.id
    where fp.active=true
      and fp.on_current_roster=true
      and sp.price is not null
  )

  select
    b.player_id,
    b.player_name,
    b.team,
    b.player_position,
    b.price,
    b.games_scored,
    round(b.season_ppg,2),
    round(b.form_ppg,2),
    round(b.venue_ppg,2),
    b.opponent,
    b.next_game_at,
    b.is_home,
    round(b.opponent_factor,3),
    b.next3_games,
    round(b.xfp_next_game,2),
    round(b.xfp_next3,2),
    case
      when b.price>0 then round(b.xfp_next3/b.price,3)
      else 0::numeric
    end,
    case
      when b.games_scored>=10 then 'high'
      when b.games_scored>=5 then 'medium'
      else 'low'
    end
  from base b
  order by b.xfp_next_game desc,b.player_name;
end;
$$;

revoke all on function get_fantasy_xfp_admin_v1(text) from public;
grant execute on function get_fantasy_xfp_admin_v1(text) to authenticated;

comment on function get_fantasy_xfp_admin_v1(text) is
  'Admin-only configurable xFP v1. Each of the next three fixtures is calculated separately using its own venue and opponent factor; xFP next 3 is their sum.';
