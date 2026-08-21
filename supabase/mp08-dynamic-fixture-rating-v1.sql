-- MP-08.5 – dynamic, explainable fixture/opponent rating
-- Reuses the existing fantasy_xfp_opponent_factor as the single source of truth.
-- During preseason the factor is preseason-based. Through the first 12 completed
-- league games for each team it blends toward live team strength, then becomes live-only.

create or replace function public.get_fantasy_fixture_rating_admin_v1(p_season text default '2026/27')
returns table(
  team text,
  position_group text,
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
    select public.fantasy_team_key(g.home_team) as team_key from public.fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
    union all
    select public.fantasy_team_key(g.away_team) as team_key from public.fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
  ),
  game_counts as (
    select c.team_key,count(*)::integer as games from completed c group by c.team_key
  ),
  rated as (
    select t.team,p.position_group,
      public.fantasy_xfp_opponent_factor(t.team,p.position_group,p_season)::numeric as factor,
      coalesce(gc.games,0)::integer as games
    from teams t cross join positions p
    left join game_counts gc on gc.team_key=public.fantasy_team_key(t.team)
  )
  select r.team,r.position_group,round(r.factor,3),
    case when r.factor<=0.85 then 1 when r.factor<=0.95 then 2 when r.factor<1.05 then 3 when r.factor<1.15 then 4 else 5 end::integer,
    case when r.factor<=0.85 then 'Svært vanskelig' when r.factor<=0.95 then 'Vanskelig' when r.factor<1.05 then 'Nøytral' when r.factor<1.15 then 'Lett' else 'Svært lett' end::text,
    r.games,
    round(least(1::numeric,r.games::numeric/12::numeric),3),
    case when r.games=0 then 'preseason' when r.games<12 then 'blended' else 'live' end::text
  from rated r
  order by r.team,r.position_group;
end;
$$;

revoke all on function public.get_fantasy_fixture_rating_admin_v1(text) from public,anon;
grant execute on function public.get_fantasy_fixture_rating_admin_v1(text) to authenticated;
