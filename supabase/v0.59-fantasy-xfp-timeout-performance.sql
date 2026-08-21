-- Stang Inn Fantasy Hockey – v0.59
-- Performance fix for admin xFP calculations.
--
-- Root cause:
-- 1) fantasy_team_key was implemented in PL/pgSQL and is called many thousands of
--    times in the xFP baseline query.
-- 2) fantasy_xfp_opponent_factor repeatedly scanned the season schedule even when
--    the 2026/27 regular season had no completed games yet.
--
-- This migration keeps the existing xFP model and output unchanged, but makes the
-- team normalizer SQL/inlinable and adds a preseason fast path to opponent factor.
-- Actual Fantasy scoring is untouched.

create or replace function public.fantasy_team_key(p_team text)
returns text
language sql
immutable
parallel safe
set search_path=public
as $$
  select case
    when lower(coalesce(p_team,'')) like '%frisk asker%' then 'frisk'
    when lower(coalesce(p_team,'')) like '%lillehammer%' then 'lillehammer'
    when lower(coalesce(p_team,'')) like '%lørenskog%' then 'lorenskog'
    when lower(coalesce(p_team,'')) like '%narvik%' then 'narvik'
    when lower(coalesce(p_team,'')) like '%nidaros%' then 'nidaros'
    when lower(coalesce(p_team,'')) like '%ringerike%' then 'ringerike'
    when lower(coalesce(p_team,'')) like '%sparta%' then 'sparta'
    when lower(coalesce(p_team,'')) like '%stavanger%' then 'stavanger'
    when lower(coalesce(p_team,'')) like '%stjernen%' then 'stjernen'
    when lower(coalesce(p_team,'')) like '%storhamar%' then 'storhamar'
    when lower(coalesce(p_team,'')) like '%vålerenga%' then 'valerenga'
    else trim(lower(coalesce(p_team,'')))
  end;
$$;

create or replace function public.fantasy_xfp_opponent_factor(
  p_opponent text,
  p_position text,
  p_season text default '2026/27'
)
returns numeric
language plpgsql
stable
set search_path=public
as $$
declare
  v_key text:=fantasy_team_key(p_opponent);
  v_games integer:=0;
  v_team_gf numeric;
  v_team_ga numeric;
  v_league_goals numeric;
  v_live numeric:=1;
  v_pre numeric:=fantasy_xfp_preseason_factor(p_opponent);
  v_live_weight numeric:=0;
  v_result numeric;
begin
  -- During preseason there is no live 2026/27 league sample to blend in.
  -- Return the existing preseason anchor immediately instead of rescanning the
  -- whole fantasy_games table for every player/fixture.
  if not exists (
    select 1
    from fantasy_games g
    where g.season=p_season
      and g.home_score is not null
      and g.away_score is not null
    limit 1
  ) then
    return round(greatest(0.70::numeric,least(1.35::numeric,v_pre)),3);
  end if;

  with completed as materialized (
    select
      fantasy_team_key(g.home_team) as home_key,
      fantasy_team_key(g.away_team) as away_key,
      g.home_score::numeric as home_score,
      g.away_score::numeric as away_score
    from fantasy_games g
    where g.season=p_season
      and g.home_score is not null
      and g.away_score is not null
  ),
  team_results as (
    select c.home_score as gf,c.away_score as ga
    from completed c where c.home_key=v_key
    union all
    select c.away_score as gf,c.home_score as ga
    from completed c where c.away_key=v_key
  ),
  team_stats as (
    select count(*)::integer as games,avg(gf)::numeric as team_gf,avg(ga)::numeric as team_ga
    from team_results
  ),
  league_stats as (
    select avg(x.goals)::numeric as league_goals
    from (
      select c.home_score as goals from completed c
      union all
      select c.away_score as goals from completed c
    ) x
  )
  select ts.games,ts.team_gf,ts.team_ga,ls.league_goals
  into v_games,v_team_gf,v_team_ga,v_league_goals
  from team_stats ts cross join league_stats ls;

  if v_games>0 and v_league_goals is not null and v_league_goals>0 then
    if p_position='G' then
      if coalesce(v_team_gf,0)>0 then
        v_live:=power(v_league_goals/v_team_gf,1.15);
      else
        v_live:=1.35;
      end if;
    else
      if v_team_ga is not null then
        v_live:=power(v_team_ga/v_league_goals,1.15);
      end if;
    end if;
    v_live:=greatest(0.70::numeric,least(1.35::numeric,v_live));
  end if;

  v_live_weight:=least(1::numeric,v_games::numeric/12::numeric);
  v_result:=(1-v_live_weight)*v_pre + v_live_weight*v_live;

  return round(greatest(0.70::numeric,least(1.35::numeric,v_result)),3);
end;
$$;

notify pgrst, 'reload schema';
