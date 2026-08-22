-- MP-08.5 v3 – fixture rating without preseason/training-game statistics
-- Locked baseline: complete 2025/26 EHL regular season (225 games).
-- Skaters use opponent GA relative to league average; goalies use inverse opponent GF.
-- Curve exponent 0.80, safety clamp 0.70–1.35. Ringerike has neutral 1.000 because
-- no 2025/26 EHL baseline exists. Baseline fades linearly to live 2026/27 over 12 games.

create or replace function public.fantasy_xfp_historical_opponent_factor(p_opponent text,p_position text)
returns numeric language sql immutable set search_path=public as $$
  select case when p_position='G' then case public.fantasy_team_key(p_opponent)
    when 'frisk' then 0.935::numeric when 'lillehammer' then 1.196::numeric
    when 'narvik' then 1.001::numeric when 'nidaros' then 1.325::numeric
    when 'sparta' then 1.205::numeric when 'stavanger' then 0.836::numeric
    when 'stjernen' then 1.170::numeric when 'storhamar' then 0.746::numeric
    when 'valerenga' then 0.791::numeric when 'ringerike' then 1.000::numeric
    else 1.000::numeric end
  else case public.fantasy_team_key(p_opponent)
    when 'frisk' then 0.723::numeric when 'lillehammer' then 1.087::numeric
    when 'narvik' then 1.145::numeric when 'nidaros' then 1.330::numeric
    when 'sparta' then 1.017::numeric when 'stavanger' then 0.824::numeric
    when 'stjernen' then 1.081::numeric when 'storhamar' then 0.767::numeric
    when 'valerenga' then 0.703::numeric when 'ringerike' then 1.000::numeric
    else 1.000::numeric end end;
$$;

create or replace function public.fantasy_xfp_opponent_factor(p_opponent text,p_position text,p_season text default '2026/27')
returns numeric language plpgsql stable set search_path=public as $$
declare v_key text:=public.fantasy_team_key(p_opponent); v_games integer:=0;
  v_baseline numeric:=public.fantasy_xfp_historical_opponent_factor(p_opponent,p_position);
  v_live numeric:=1; v_live_weight numeric:=0; v_result numeric;
begin
  select count(*)::integer into v_games from public.fantasy_games g
  where g.season=p_season and g.home_score is not null and g.away_score is not null
    and (public.fantasy_team_key(g.home_team)=v_key or public.fantasy_team_key(g.away_team)=v_key);
  if v_games>0 then v_live:=public.fantasy_xfp_live_opponent_factor(p_opponent,p_position,p_season); end if;
  v_live_weight:=least(1::numeric,v_games::numeric/12::numeric);
  v_result:=(1-v_live_weight)*v_baseline+v_live_weight*v_live;
  return round(greatest(0.70::numeric,least(1.35::numeric,v_result)),3);
end; $$;

create or replace function public.get_fantasy_fixture_rating_admin_v3(p_season text default '2026/27')
returns table(team text,position_group text,baseline_factor numeric,live_factor numeric,opponent_factor numeric,fixture_rating integer,fixture_label text,completed_games integer,live_weight numeric,rating_source text)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  return query with teams as (
    select distinct fp.team from public.fantasy_players fp where fp.active=true and fp.on_current_roster=true and nullif(trim(fp.team),'') is not null
  ), positions as (select unnest(array['F','D','G'])::text position_group), completed as (
    select public.fantasy_team_key(g.home_team) team_key from public.fantasy_games g where g.season=p_season and g.home_score is not null and g.away_score is not null
    union all select public.fantasy_team_key(g.away_team) from public.fantasy_games g where g.season=p_season and g.home_score is not null and g.away_score is not null
  ), game_counts as (select c.team_key,count(*)::integer games from completed c group by c.team_key), rated as (
    select t.team,p.position_group,public.fantasy_xfp_historical_opponent_factor(t.team,p.position_group)::numeric baseline_factor,
      public.fantasy_xfp_live_opponent_factor(t.team,p.position_group,p_season)::numeric live_factor,
      public.fantasy_xfp_opponent_factor(t.team,p.position_group,p_season)::numeric factor,coalesce(gc.games,0)::integer games
    from teams t cross join positions p left join game_counts gc on gc.team_key=public.fantasy_team_key(t.team)
  ) select r.team,r.position_group,round(r.baseline_factor,3),round(r.live_factor,3),round(r.factor,3),
    case when r.factor<=0.85 then 1 when r.factor<=0.95 then 2 when r.factor<1.05 then 3 when r.factor<1.15 then 4 else 5 end::integer,
    case when r.factor<=0.85 then 'Svært vanskelig' when r.factor<=0.95 then 'Vanskelig' when r.factor<1.05 then 'Nøytral' when r.factor<1.15 then 'Lett' else 'Svært lett' end::text,
    r.games,round(least(1::numeric,r.games::numeric/12::numeric),3),case when r.games=0 then 'historical_baseline' when r.games<12 then 'blended' else 'live' end::text
  from rated r order by r.team,r.position_group;
end; $$;

revoke all on function public.fantasy_xfp_historical_opponent_factor(text,text) from public,anon;
grant execute on function public.fantasy_xfp_historical_opponent_factor(text,text) to authenticated;
revoke all on function public.get_fantasy_fixture_rating_admin_v3(text) from public,anon;
grant execute on function public.get_fantasy_fixture_rating_admin_v3(text) to authenticated;
comment on function public.fantasy_xfp_historical_opponent_factor(text,text) is 'MP-08.5 v3 locked 2025/26 EHL regular-season baseline; no preseason/training-game statistics.';
comment on function public.fantasy_xfp_opponent_factor(text,text,text) is 'MP-08.5 v3 historical baseline blended linearly to live 2026/27 over first 12 completed games; no preseason/training-game statistics.';
notify pgrst,'reload schema';
