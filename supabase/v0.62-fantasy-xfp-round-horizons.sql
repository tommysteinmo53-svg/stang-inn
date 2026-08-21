-- Stang Inn Fantasy Hockey – v0.62
-- MP-08.8: expected PLAYER xFP for next game, next fantasy round and next 3 fantasy rounds.
--
-- Important separation of concepts:
-- 1) This RPC returns base player xFP horizons before availability.
-- 2) Availability is applied in the server/API layer.
-- 3) Line 1/Line 2 and C/VC multipliers are lineup-context rules and are NOT
--    applied to this generic player forecast. The optimizer applies those when
--    calculating effective Fantasy-xFP for a concrete lineup.
--
-- No production Fantasy scoring rules are changed here.

create or replace function public.get_fantasy_xfp_round_horizons_admin_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  price numeric,
  data_confidence text,
  next_round_no integer,
  next_round_name text,
  next_round_games integer,
  next3_round_games integer,
  base_xfp_next_game numeric,
  base_xfp_next_round numeric,
  base_xfp_next3_rounds numeric
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
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  select s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight
  into v_season_weight,v_form_weight,v_venue_weight,v_opponent_weight
  from fantasy_xfp_settings s where s.season=p_season;
  if not found then raise exception 'xFP settings missing for season %',p_season; end if;

  return query
  with base as materialized (
    select * from get_fantasy_xfp_admin_v1(p_season)
  ),
  next_rounds as materialized (
    select fr.id,fr.round_no,fr.name,fr.starts_at,
           row_number() over(order by fr.starts_at,fr.round_no)::integer horizon_no
    from fantasy_rounds fr
    where fr.season=p_season
      and fr.ends_at>now()
    order by fr.starts_at,fr.round_no
    limit 3
  ),
  first_round as (
    select nr.id,nr.round_no,nr.name from next_rounds nr where nr.horizon_no=1
  ),
  hist_points as materialized (
    select pgs.player_id,g.home_team,g.away_team,coalesce(pgs.team_snapshot,fp.team,'') stat_team,
      (case when coalesce(pgs.position_snapshot,fp.position,'W')='G' then
        case when coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0 then 2 else 0 end
        +coalesce(pgs.goals,0)*15+coalesce(pgs.assists,0)*8+coalesce(pgs.shots,0)+coalesce(pgs.plus_minus,0)
        -least(10,greatest(0,coalesce(pgs.pim,0)))+coalesce(pgs.saves,0)/2.0-coalesce(pgs.goals_against,0)*3
        +case when coalesce(pgs.shutout,false) then 10 else 0 end+case when coalesce(pgs.win,false) then 5 else 0 end
       else
        case when coalesce(pgs.did_play,false) then 2 else 0 end
        +coalesce(pgs.goals,0)*case when coalesce(pgs.position_snapshot,fp.position,'W')='D' then 15 else 10 end
        +coalesce(pgs.assists,0)*case when coalesce(pgs.position_snapshot,fp.position,'W')='D' then 8 else 6 end
        +coalesce(pgs.shots,0)+coalesce(pgs.plus_minus,0)-least(10,greatest(0,coalesce(pgs.pim,0))) end)::numeric fantasy_points
    from fantasy_player_game_stats pgs
    join fantasy_games g on g.id=pgs.game_id and g.season='2025/26'
    join fantasy_players fp on fp.id=pgs.player_id
    join base b on b.player_id=pgs.player_id
    where case when coalesce(pgs.position_snapshot,fp.position,'W')='G'
      then coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0
      else coalesce(pgs.did_play,false) end
  ),
  hist_venue as (
    select hp.player_id,
      avg(hp.fantasy_points) filter(where fantasy_team_key(hp.home_team)=fantasy_team_key(hp.stat_team))::numeric home_ppg,
      avg(hp.fantasy_points) filter(where fantasy_team_key(hp.away_team)=fantasy_team_key(hp.stat_team))::numeric away_ppg
    from hist_points hp group by hp.player_id
  ),
  current_latest as materialized (
    select distinct on(fpp.player_id,fpp.game_id) fpp.player_id,fpp.game_id,fpp.actual_points::numeric actual_points,g.home_team,g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id and g.season=p_season
    join base b on b.player_id=fpp.player_id
    order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ),
  current_venue as (
    select b.player_id,
      avg(cl.actual_points) filter(where fantasy_team_key(cl.home_team)=fantasy_team_key(b.team))::numeric home_ppg,
      avg(cl.actual_points) filter(where fantasy_team_key(cl.away_team)=fantasy_team_key(b.team))::numeric away_ppg
    from base b left join current_latest cl on cl.player_id=b.player_id group by b.player_id
  ),
  venue_blend as materialized (
    select b.player_id,
      ((1-least(1::numeric,b.games_scored::numeric/10))*coalesce(hv.home_ppg,b.season_ppg)
       +least(1::numeric,b.games_scored::numeric/10)*coalesce(cv.home_ppg,b.season_ppg))::numeric home_ppg,
      ((1-least(1::numeric,b.games_scored::numeric/10))*coalesce(hv.away_ppg,b.season_ppg)
       +least(1::numeric,b.games_scored::numeric/10)*coalesce(cv.away_ppg,b.season_ppg))::numeric away_ppg
    from base b left join hist_venue hv on hv.player_id=b.player_id left join current_venue cv on cv.player_id=b.player_id
  ),
  fixtures as materialized (
    select b.player_id,b.player_position,g.id game_id,g.starts_at,nr.horizon_no,nr.round_no,
      (fantasy_team_key(g.home_team)=fantasy_team_key(b.team)) is_home,
      case when fantasy_team_key(g.home_team)=fantasy_team_key(b.team) then g.away_team else g.home_team end opponent
    from base b
    join fantasy_games g on fantasy_team_key(g.home_team)=fantasy_team_key(b.team) or fantasy_team_key(g.away_team)=fantasy_team_key(b.team)
    join next_rounds nr on nr.id=g.fantasy_round_id
    where g.season=p_season and g.starts_at>now()
      and (g.status is null or g.status in('scheduled','postponed','live','in_progress'))
  ),
  fixture_xfp as materialized (
    select f.player_id,f.game_id,f.starts_at,f.horizon_no,f.round_no,
      (v_season_weight*b.season_ppg
       +v_form_weight*b.form_ppg
       +v_venue_weight*(case when f.is_home then vb.home_ppg else vb.away_ppg end)
       +v_opponent_weight*(b.season_ppg*fantasy_xfp_opponent_factor(f.opponent,f.player_position,p_season)))::numeric xfp
    from fixtures f join base b on b.player_id=f.player_id join venue_blend vb on vb.player_id=f.player_id
  ),
  summary as (
    select b.player_id,
      count(fx.game_id) filter(where fx.horizon_no=1)::integer next_round_games,
      count(fx.game_id)::integer next3_round_games,
      coalesce(sum(fx.xfp) filter(where fx.horizon_no=1),0)::numeric xfp_next_round,
      coalesce(sum(fx.xfp),0)::numeric xfp_next3_rounds
    from base b left join fixture_xfp fx on fx.player_id=b.player_id group by b.player_id
  )
  select b.player_id,b.player_name,b.team,b.player_position,b.price,b.data_confidence,
    fr.round_no,fr.name,
    coalesce(s.next_round_games,0),coalesce(s.next3_round_games,0),
    round(coalesce(b.xfp_next_game,0),2),round(coalesce(s.xfp_next_round,0),2),round(coalesce(s.xfp_next3_rounds,0),2)
  from base b cross join first_round fr left join summary s on s.player_id=b.player_id
  order by round(coalesce(s.xfp_next3_rounds,0),2) desc,b.player_name;
end;
$$;

revoke all on function public.get_fantasy_xfp_round_horizons_admin_v1(text) from public;
grant execute on function public.get_fantasy_xfp_round_horizons_admin_v1(text) to authenticated;
comment on function public.get_fantasy_xfp_round_horizons_admin_v1(text) is
  'MP-08 admin-only base player xFP horizons: next game, next fantasy round and next three fantasy rounds. Does not apply availability or lineup/C/VC multipliers.';
notify pgrst,'reload schema';
