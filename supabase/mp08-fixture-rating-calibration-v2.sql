-- MP-08.5 – fixture-rating calibration v2
-- Calibrates the live opponent curve against 2025/26 production history.
-- Keeps the 0.70–1.35 safety clamps and the 12-game linear transition,
-- but reduces the live exponent from 1.15 to 0.80 to preserve rating nuance.
-- Adds an explainable admin RPC exposing preseason, live and blended factors.

create or replace function public.fantasy_xfp_live_opponent_factor(
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
  v_key text:=public.fantasy_team_key(p_opponent);
  v_games integer:=0;
  v_team_gf numeric;
  v_team_ga numeric;
  v_league_goals numeric;
  v_live numeric:=1;
begin
  with team_results as (
    select
      case when public.fantasy_team_key(g.home_team)=v_key then g.home_score::numeric else g.away_score::numeric end as gf,
      case when public.fantasy_team_key(g.home_team)=v_key then g.away_score::numeric else g.home_score::numeric end as ga
    from public.fantasy_games g
    where g.season=p_season
      and g.home_score is not null
      and g.away_score is not null
      and (public.fantasy_team_key(g.home_team)=v_key or public.fantasy_team_key(g.away_team)=v_key)
  )
  select count(*)::integer,avg(gf),avg(ga)
  into v_games,v_team_gf,v_team_ga
  from team_results;

  select avg(x.goals)::numeric
  into v_league_goals
  from (
    select g.home_score::numeric as goals
    from public.fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
    union all
    select g.away_score::numeric
    from public.fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
  ) x;

  if v_games=0 or v_league_goals is null or v_league_goals<=0 then
    return 1.000::numeric;
  end if;

  if p_position='G' then
    -- Keeper: low-scoring opponent is easier; high-scoring opponent is harder.
    if coalesce(v_team_gf,0)>0 then
      v_live:=power(v_league_goals/v_team_gf,0.80);
    else
      v_live:=1.35;
    end if;
  else
    -- Skater: team conceding many goals is easier; stingy defense is harder.
    if v_team_ga is not null then
      v_live:=power(v_team_ga/v_league_goals,0.80);
    end if;
  end if;

  return round(greatest(0.70::numeric,least(1.35::numeric,v_live)),3);
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
  v_key text:=public.fantasy_team_key(p_opponent);
  v_games integer:=0;
  v_pre numeric:=public.fantasy_xfp_preseason_factor(p_opponent);
  v_live numeric:=1;
  v_live_weight numeric:=0;
  v_result numeric;
begin
  select count(*)::integer
  into v_games
  from public.fantasy_games g
  where g.season=p_season
    and g.home_score is not null
    and g.away_score is not null
    and (public.fantasy_team_key(g.home_team)=v_key or public.fantasy_team_key(g.away_team)=v_key);

  if v_games>0 then
    v_live:=public.fantasy_xfp_live_opponent_factor(p_opponent,p_position,p_season);
  end if;

  -- 0 games = 100% preseason; 6 games = 50/50; 12+ games = 100% live.
  v_live_weight:=least(1::numeric,v_games::numeric/12::numeric);
  v_result:=(1-v_live_weight)*v_pre + v_live_weight*v_live;

  return round(greatest(0.70::numeric,least(1.35::numeric,v_result)),3);
end;
$$;

create or replace function public.get_fantasy_fixture_rating_admin_v2(p_season text default '2026/27')
returns table(
  team text,
  position_group text,
  preseason_factor numeric,
  live_factor numeric,
  opponent_factor numeric,
  fixture_rating integer,
  fixture_label text,
  completed_games integer,
  live_weight numeric,
  rating_source text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  return query
  with teams as (
    select distinct fp.team
    from public.fantasy_players fp
    where fp.active=true and fp.on_current_roster=true and nullif(trim(fp.team),'') is not null
  ),
  positions as (
    select unnest(array['F','D','G'])::text as position_group
  ),
  completed as (
    select public.fantasy_team_key(g.home_team) as team_key
    from public.fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
    union all
    select public.fantasy_team_key(g.away_team) as team_key
    from public.fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
  ),
  game_counts as (
    select c.team_key,count(*)::integer as games from completed c group by c.team_key
  ),
  rated as (
    select t.team,p.position_group,
      public.fantasy_xfp_preseason_factor(t.team)::numeric as pre_factor,
      public.fantasy_xfp_live_opponent_factor(t.team,p.position_group,p_season)::numeric as live_factor,
      public.fantasy_xfp_opponent_factor(t.team,p.position_group,p_season)::numeric as factor,
      coalesce(gc.games,0)::integer as games
    from teams t cross join positions p
    left join game_counts gc on gc.team_key=public.fantasy_team_key(t.team)
  )
  select r.team,r.position_group,round(r.pre_factor,3),round(r.live_factor,3),round(r.factor,3),
    case when r.factor<=0.85 then 1 when r.factor<=0.95 then 2 when r.factor<1.05 then 3 when r.factor<1.15 then 4 else 5 end::integer,
    case when r.factor<=0.85 then 'Svært vanskelig' when r.factor<=0.95 then 'Vanskelig' when r.factor<1.05 then 'Nøytral' when r.factor<1.15 then 'Lett' else 'Svært lett' end::text,
    r.games,
    round(least(1::numeric,r.games::numeric/12::numeric),3),
    case when r.games=0 then 'preseason' when r.games<12 then 'blended' else 'live' end::text
  from rated r
  order by r.team,r.position_group;
end;
$$;

revoke all on function public.fantasy_xfp_live_opponent_factor(text,text,text) from public,anon;
grant execute on function public.fantasy_xfp_live_opponent_factor(text,text,text) to authenticated;
revoke all on function public.get_fantasy_fixture_rating_admin_v2(text) from public,anon;
grant execute on function public.get_fantasy_fixture_rating_admin_v2(text) to authenticated;

comment on function public.fantasy_xfp_live_opponent_factor(text,text,text) is
  'MP-08.5 v2 pure live opponent factor, exponent 0.80, safety-clamped 0.70–1.35.';
comment on function public.fantasy_xfp_opponent_factor(text,text,text) is
  'MP-08.5 v2 authoritative opponent factor: preseason anchor blended linearly to calibrated live factor over 12 completed games.';
comment on function public.get_fantasy_fixture_rating_admin_v2(text) is
  'MP-08.5 v2 explainable admin rating: preseason, live, blended factor, live weight and 1–5 rating.';

notify pgrst,'reload schema';
