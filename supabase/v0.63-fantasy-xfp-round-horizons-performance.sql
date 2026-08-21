-- Stang Inn Fantasy Hockey – v0.63
-- MP-08.8 performance fix.
-- Self-contained target-only horizon calculation. Avoids calling the heavy
-- get_fantasy_xfp_admin_v1() and then rescanning history a second time.
-- Generic player xFP only: availability is applied in API; line/C/VC remain lineup context.

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
  with target as materialized (
    select fp.id,fp.name,fp.team,fp.position,sp.price::numeric price,
      case when fp.position in('C','W','F') then 'F' else fp.position end norm_pos
    from fantasy_players fp
    join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
    where fp.active=true and fp.on_current_roster=true and sp.price is not null
  ),
  hist as materialized (
    select pgs.player_id,g.starts_at,g.home_team,g.away_team,
      coalesce(pgs.team_snapshot,t.team,'') stat_team,
      (case when coalesce(pgs.position_snapshot,t.position,'W')='G' then
        case when coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0 then 2 else 0 end
        +coalesce(pgs.goals,0)*15+coalesce(pgs.assists,0)*8+coalesce(pgs.shots,0)+coalesce(pgs.plus_minus,0)
        -least(10,greatest(0,coalesce(pgs.pim,0)))+coalesce(pgs.saves,0)/2.0-coalesce(pgs.goals_against,0)*3
        +case when coalesce(pgs.shutout,false) then 10 else 0 end+case when coalesce(pgs.win,false) then 5 else 0 end
       else
        case when coalesce(pgs.did_play,false) then 2 else 0 end
        +coalesce(pgs.goals,0)*case when coalesce(pgs.position_snapshot,t.position,'W')='D' then 15 else 10 end
        +coalesce(pgs.assists,0)*case when coalesce(pgs.position_snapshot,t.position,'W')='D' then 8 else 6 end
        +coalesce(pgs.shots,0)+coalesce(pgs.plus_minus,0)-least(10,greatest(0,coalesce(pgs.pim,0))) end)::numeric fantasy_points
    from fantasy_player_game_stats pgs
    join fantasy_games g on g.id=pgs.game_id and g.season='2025/26'
    join target t on t.id=pgs.player_id
    where case when coalesce(pgs.position_snapshot,t.position,'W')='G'
      then coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0
      else coalesce(pgs.did_play,false) end
  ),
  hist_ranked as (
    select h.*,row_number() over(partition by h.player_id order by h.starts_at desc) rn from hist h
  ),
  hist_base as materialized (
    select h.player_id,count(*)::integer games,avg(h.fantasy_points)::numeric season_ppg
    from hist h group by h.player_id
  ),
  hist_form as (
    select h.player_id,avg(h.fantasy_points)::numeric form_ppg from hist_ranked h where h.rn<=5 group by h.player_id
  ),
  hist_venue as (
    select h.player_id,
      avg(h.fantasy_points) filter(where fantasy_team_key(h.home_team)=fantasy_team_key(h.stat_team))::numeric home_ppg,
      avg(h.fantasy_points) filter(where fantasy_team_key(h.away_team)=fantasy_team_key(h.stat_team))::numeric away_ppg
    from hist h group by h.player_id
  ),
  position_prior as materialized (
    select t.norm_pos,
      percentile_cont(0.5) within group(order by hb.season_ppg/t.price)::numeric ppg_per_m
    from hist_base hb join target t on t.id=hb.player_id
    where hb.games>=5 and hb.season_ppg>0 and t.price>0
    group by t.norm_pos
  ),
  prior as materialized (
    select t.id player_id,
      coalesce(hb.games,0)::integer hist_games,
      coalesce(hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric season_ppg,
      coalesce(hf.form_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric form_ppg,
      coalesce(hv.home_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric home_ppg,
      coalesce(hv.away_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric away_ppg
    from target t
    left join hist_base hb on hb.player_id=t.id
    left join hist_form hf on hf.player_id=t.id
    left join hist_venue hv on hv.player_id=t.id
    left join position_prior pp on pp.norm_pos=t.norm_pos
  ),
  current_latest as materialized (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,fpp.game_id,fpp.actual_points::numeric actual_points,g.starts_at,g.home_team,g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id and g.season=p_season
    join target t on t.id=fpp.player_id
    order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ),
  current_base as (
    select c.player_id,count(*)::integer games,avg(c.actual_points)::numeric season_ppg from current_latest c group by c.player_id
  ),
  current_ranked as (
    select c.*,row_number() over(partition by c.player_id order by c.starts_at desc) rn from current_latest c
  ),
  current_form as (
    select c.player_id,avg(c.actual_points)::numeric form_ppg from current_ranked c where c.rn<=5 group by c.player_id
  ),
  current_venue as (
    select t.id player_id,
      avg(c.actual_points) filter(where fantasy_team_key(c.home_team)=fantasy_team_key(t.team))::numeric home_ppg,
      avg(c.actual_points) filter(where fantasy_team_key(c.away_team)=fantasy_team_key(t.team))::numeric away_ppg
    from target t left join current_latest c on c.player_id=t.id group by t.id
  ),
  blended as materialized (
    select t.id player_id,coalesce(cb.games,0)::integer current_games,p.hist_games,
      ((1-least(1::numeric,coalesce(cb.games,0)::numeric/10))*p.season_ppg + least(1::numeric,coalesce(cb.games,0)::numeric/10)*coalesce(cb.season_ppg,p.season_ppg))::numeric season_ppg,
      ((1-least(1::numeric,coalesce(cb.games,0)::numeric/10))*p.form_ppg + least(1::numeric,coalesce(cb.games,0)::numeric/10)*coalesce(cf.form_ppg,cb.season_ppg,p.form_ppg))::numeric form_ppg,
      ((1-least(1::numeric,coalesce(cb.games,0)::numeric/10))*p.home_ppg + least(1::numeric,coalesce(cb.games,0)::numeric/10)*coalesce(cv.home_ppg,cb.season_ppg,p.home_ppg))::numeric home_ppg,
      ((1-least(1::numeric,coalesce(cb.games,0)::numeric/10))*p.away_ppg + least(1::numeric,coalesce(cb.games,0)::numeric/10)*coalesce(cv.away_ppg,cb.season_ppg,p.away_ppg))::numeric away_ppg
    from target t join prior p on p.player_id=t.id
    left join current_base cb on cb.player_id=t.id
    left join current_form cf on cf.player_id=t.id
    left join current_venue cv on cv.player_id=t.id
  ),
  next_rounds as materialized (
    select fr.id,fr.round_no,fr.name,fr.starts_at,
      row_number() over(order by fr.starts_at,fr.round_no)::integer horizon_no
    from fantasy_rounds fr
    where fr.season=p_season and fr.ends_at>now()
    order by fr.starts_at,fr.round_no limit 3
  ),
  first_round as (
    select nr.round_no,nr.name from next_rounds nr where nr.horizon_no=1
  ),
  fixtures as materialized (
    select t.id player_id,t.position player_position,g.id game_id,g.starts_at,nr.horizon_no,
      (fantasy_team_key(g.home_team)=fantasy_team_key(t.team)) is_home,
      case when fantasy_team_key(g.home_team)=fantasy_team_key(t.team) then g.away_team else g.home_team end opponent
    from target t
    join fantasy_games g on fantasy_team_key(g.home_team)=fantasy_team_key(t.team) or fantasy_team_key(g.away_team)=fantasy_team_key(t.team)
    join next_rounds nr on nr.id=g.fantasy_round_id
    where g.season=p_season and g.starts_at>now()
      and (g.status is null or g.status in('scheduled','postponed','live','in_progress'))
  ),
  fixture_xfp as materialized (
    select f.player_id,f.game_id,f.starts_at,f.horizon_no,
      (v_season_weight*b.season_ppg + v_form_weight*b.form_ppg
       + v_venue_weight*(case when f.is_home then b.home_ppg else b.away_ppg end)
       + v_opponent_weight*(b.season_ppg*fantasy_xfp_opponent_factor(f.opponent,f.player_position,p_season)))::numeric xfp
    from fixtures f join blended b on b.player_id=f.player_id
  ),
  next_game as (
    select distinct on(f.player_id) f.player_id,f.xfp from fixture_xfp f order by f.player_id,f.starts_at,f.game_id
  ),
  summary as (
    select t.id player_id,
      count(f.game_id) filter(where f.horizon_no=1)::integer next_round_games,
      count(f.game_id)::integer next3_round_games,
      coalesce(sum(f.xfp) filter(where f.horizon_no=1),0)::numeric xfp_next_round,
      coalesce(sum(f.xfp),0)::numeric xfp_next3_rounds
    from target t left join fixture_xfp f on f.player_id=t.id group by t.id
  )
  select t.id,t.name,t.team,t.position,t.price,
    case when b.current_games>=5 then 'high' when b.hist_games>=5 then 'medium' else 'low' end,
    fr.round_no,fr.name,
    coalesce(s.next_round_games,0),coalesce(s.next3_round_games,0),
    round(coalesce(ng.xfp,0),2),round(coalesce(s.xfp_next_round,0),2),round(coalesce(s.xfp_next3_rounds,0),2)
  from target t
  join blended b on b.player_id=t.id
  cross join first_round fr
  left join next_game ng on ng.player_id=t.id
  left join summary s on s.player_id=t.id
  order by round(coalesce(s.xfp_next3_rounds,0),2) desc,t.name;
end;
$$;

revoke all on function public.get_fantasy_xfp_round_horizons_admin_v1(text) from public;
grant execute on function public.get_fantasy_xfp_round_horizons_admin_v1(text) to authenticated;
comment on function public.get_fantasy_xfp_round_horizons_admin_v1(text) is
  'MP-08 v0.63 optimized player xFP horizons. Self-contained target-only calculation; avoids nested full xFP RPC.';
notify pgrst,'reload schema';
