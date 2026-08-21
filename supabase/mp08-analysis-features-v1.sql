-- MP-08.4 – canonical observed analysis features v1
-- Separates observed/blended player features from xFP, availability and recommendations.
-- Does NOT change Fantasy scoring rules or model weights.

create or replace function public.get_fantasy_analysis_features_admin_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  price numeric,
  historical_games integer,
  current_games integer,
  season_ppg numeric,
  form3_ppg numeric,
  form5_ppg numeric,
  form10_ppg numeric,
  historical_home_games integer,
  current_home_games integer,
  home_ppg numeric,
  historical_away_games integer,
  current_away_games integer,
  away_ppg numeric,
  observed_value_per_million numeric,
  data_confidence text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

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
  hist_agg as materialized (
    select h.player_id,
      count(*)::integer games,
      avg(h.fantasy_points)::numeric season_ppg,
      avg(h.fantasy_points) filter(where h.rn<=3)::numeric form3_ppg,
      avg(h.fantasy_points) filter(where h.rn<=5)::numeric form5_ppg,
      avg(h.fantasy_points) filter(where h.rn<=10)::numeric form10_ppg,
      count(*) filter(where fantasy_team_key(h.home_team)=fantasy_team_key(h.stat_team))::integer home_games,
      avg(h.fantasy_points) filter(where fantasy_team_key(h.home_team)=fantasy_team_key(h.stat_team))::numeric home_ppg,
      count(*) filter(where fantasy_team_key(h.away_team)=fantasy_team_key(h.stat_team))::integer away_games,
      avg(h.fantasy_points) filter(where fantasy_team_key(h.away_team)=fantasy_team_key(h.stat_team))::numeric away_ppg
    from hist_ranked h group by h.player_id
  ),
  position_prior as materialized (
    select t.norm_pos,
      percentile_cont(0.5) within group(order by ha.season_ppg/t.price)::numeric ppg_per_m
    from hist_agg ha join target t on t.id=ha.player_id
    where ha.games>=5 and ha.season_ppg>0 and t.price>0
    group by t.norm_pos
  ),
  prior as materialized (
    select t.id player_id,
      coalesce(ha.games,0)::integer historical_games,
      coalesce(ha.home_games,0)::integer historical_home_games,
      coalesce(ha.away_games,0)::integer historical_away_games,
      coalesce(ha.season_ppg,t.price*pp.ppg_per_m,0)::numeric season_ppg,
      coalesce(ha.form3_ppg,ha.season_ppg,t.price*pp.ppg_per_m,0)::numeric form3_ppg,
      coalesce(ha.form5_ppg,ha.season_ppg,t.price*pp.ppg_per_m,0)::numeric form5_ppg,
      coalesce(ha.form10_ppg,ha.season_ppg,t.price*pp.ppg_per_m,0)::numeric form10_ppg,
      coalesce(ha.home_ppg,ha.season_ppg,t.price*pp.ppg_per_m,0)::numeric home_ppg,
      coalesce(ha.away_ppg,ha.season_ppg,t.price*pp.ppg_per_m,0)::numeric away_ppg
    from target t
    left join hist_agg ha on ha.player_id=t.id
    left join position_prior pp on pp.norm_pos=t.norm_pos
  ),
  current_latest as materialized (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,fpp.game_id,fpp.actual_points::numeric actual_points,
      g.starts_at,g.home_team,g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id and g.season=p_season
    join target t on t.id=fpp.player_id
    order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ),
  current_ranked as (
    select c.*,row_number() over(partition by c.player_id order by c.starts_at desc) rn
    from current_latest c
  ),
  current_agg as materialized (
    select t.id player_id,
      count(c.game_id)::integer games,
      avg(c.actual_points)::numeric season_ppg,
      avg(c.actual_points) filter(where c.rn<=3)::numeric form3_ppg,
      avg(c.actual_points) filter(where c.rn<=5)::numeric form5_ppg,
      avg(c.actual_points) filter(where c.rn<=10)::numeric form10_ppg,
      count(c.game_id) filter(where fantasy_team_key(c.home_team)=fantasy_team_key(t.team))::integer home_games,
      avg(c.actual_points) filter(where fantasy_team_key(c.home_team)=fantasy_team_key(t.team))::numeric home_ppg,
      count(c.game_id) filter(where fantasy_team_key(c.away_team)=fantasy_team_key(t.team))::integer away_games,
      avg(c.actual_points) filter(where fantasy_team_key(c.away_team)=fantasy_team_key(t.team))::numeric away_ppg
    from target t left join current_ranked c on c.player_id=t.id
    group by t.id
  ),
  blended as (
    select t.id player_id,t.name,t.team,t.position,t.price,p.historical_games,
      coalesce(ca.games,0)::integer current_games,
      p.historical_home_games,coalesce(ca.home_games,0)::integer current_home_games,
      p.historical_away_games,coalesce(ca.away_games,0)::integer current_away_games,
      least(1::numeric,coalesce(ca.games,0)::numeric/10) live_weight,
      p.season_ppg prior_season,p.form3_ppg prior_form3,p.form5_ppg prior_form5,p.form10_ppg prior_form10,
      p.home_ppg prior_home,p.away_ppg prior_away,
      ca.season_ppg current_season,ca.form3_ppg current_form3,ca.form5_ppg current_form5,ca.form10_ppg current_form10,
      ca.home_ppg current_home,ca.away_ppg current_away
    from target t join prior p on p.player_id=t.id
    left join current_agg ca on ca.player_id=t.id
  )
  select b.player_id,b.name,b.team,b.position,b.price,
    b.historical_games,b.current_games,
    round(((1-b.live_weight)*b.prior_season+b.live_weight*coalesce(b.current_season,b.prior_season))::numeric,2),
    round(((1-b.live_weight)*b.prior_form3+b.live_weight*coalesce(b.current_form3,b.current_season,b.prior_form3))::numeric,2),
    round(((1-b.live_weight)*b.prior_form5+b.live_weight*coalesce(b.current_form5,b.current_season,b.prior_form5))::numeric,2),
    round(((1-b.live_weight)*b.prior_form10+b.live_weight*coalesce(b.current_form10,b.current_season,b.prior_form10))::numeric,2),
    b.historical_home_games,b.current_home_games,
    round(((1-b.live_weight)*b.prior_home+b.live_weight*coalesce(b.current_home,b.current_season,b.prior_home))::numeric,2),
    b.historical_away_games,b.current_away_games,
    round(((1-b.live_weight)*b.prior_away+b.live_weight*coalesce(b.current_away,b.current_season,b.prior_away))::numeric,2),
    round((case when b.price>0 then ((1-b.live_weight)*b.prior_season+b.live_weight*coalesce(b.current_season,b.prior_season))/b.price else 0 end)::numeric,3),
    case when b.current_games>=5 then 'high' when b.historical_games>=5 then 'medium' else 'low' end
  from blended b
  order by 8 desc,b.name;
end;
$$;

revoke all on function public.get_fantasy_analysis_features_admin_v1(text) from public;
grant execute on function public.get_fantasy_analysis_features_admin_v1(text) to authenticated;
comment on function public.get_fantasy_analysis_features_admin_v1(text) is
  'MP-08.4 canonical admin feature layer: observed/blended season, form 3/5/10, home/away and observed value per million. No availability or forecast logic.';

-- Rewire the existing fast horizon RPC to consume the canonical feature layer.
-- Public signature is unchanged, so current API/UI clients remain compatible.
create or replace function public.get_fantasy_xfp_round_horizons_admin_v2(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,player_name text,team text,player_position text,price numeric,
  season_ppg numeric,form_ppg numeric,next_opponent text,next_game_at timestamptz,next_is_home boolean,
  data_confidence text,next_round_no integer,next_round_name text,next_round_games integer,next3_round_games integer,
  base_xfp_next_game numeric,base_xfp_next_round numeric,base_xfp_next3_rounds numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_season_weight numeric; v_form_weight numeric; v_venue_weight numeric; v_opponent_weight numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  select s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight
    into v_season_weight,v_form_weight,v_venue_weight,v_opponent_weight
  from fantasy_xfp_settings s where s.season=p_season;
  if not found then raise exception 'xFP settings missing for season %',p_season; end if;

  return query
  with features as materialized (
    select * from public.get_fantasy_analysis_features_admin_v1(p_season)
  ),
  next_rounds as materialized (
    select fr.id,fr.round_no,fr.name,fr.starts_at,row_number() over(order by fr.starts_at,fr.round_no)::integer horizon_no
    from fantasy_rounds fr where fr.season=p_season and fr.ends_at>now()
    order by fr.starts_at,fr.round_no limit 3
  ),
  first_round as (select nr.round_no,nr.name from next_rounds nr where nr.horizon_no=1),
  fixtures as materialized (
    select f.player_id,f.player_position,g.id game_id,g.starts_at,nr.horizon_no,
      (fantasy_team_key(g.home_team)=fantasy_team_key(f.team)) is_home,
      case when fantasy_team_key(g.home_team)=fantasy_team_key(f.team) then g.away_team else g.home_team end opponent
    from features f
    join fantasy_games g on fantasy_team_key(g.home_team)=fantasy_team_key(f.team) or fantasy_team_key(g.away_team)=fantasy_team_key(f.team)
    join next_rounds nr on nr.id=g.fantasy_round_id
    where g.season=p_season and g.starts_at>now()
      and (g.status is null or g.status in('scheduled','postponed','live','in_progress'))
  ),
  fixture_xfp as materialized (
    select x.player_id,x.game_id,x.starts_at,x.horizon_no,x.opponent,x.is_home,
      (v_season_weight*f.season_ppg
       +v_form_weight*f.form5_ppg
       +v_venue_weight*(case when x.is_home then f.home_ppg else f.away_ppg end)
       +v_opponent_weight*(f.season_ppg*fantasy_xfp_opponent_factor(x.opponent,x.player_position,p_season)))::numeric xfp
    from fixtures x join features f on f.player_id=x.player_id
  ),
  next_game as (
    select distinct on(x.player_id) x.player_id,x.opponent,x.starts_at,x.is_home,x.xfp
    from fixture_xfp x order by x.player_id,x.starts_at,x.game_id
  ),
  summary as (
    select f.player_id,
      count(x.game_id) filter(where x.horizon_no=1)::integer next_round_games,
      count(x.game_id)::integer next3_round_games,
      coalesce(sum(x.xfp) filter(where x.horizon_no=1),0)::numeric xfp_next_round,
      coalesce(sum(x.xfp),0)::numeric xfp_next3_rounds
    from features f left join fixture_xfp x on x.player_id=f.player_id group by f.player_id
  )
  select f.player_id,f.player_name,f.team,f.player_position,f.price,f.season_ppg,f.form5_ppg,
    ng.opponent,ng.starts_at,ng.is_home,f.data_confidence,
    fr.round_no,fr.name,coalesce(s.next_round_games,0),coalesce(s.next3_round_games,0),
    round(coalesce(ng.xfp,0),2),round(coalesce(s.xfp_next_round,0),2),round(coalesce(s.xfp_next3_rounds,0),2)
  from features f cross join first_round fr
  left join next_game ng on ng.player_id=f.player_id
  left join summary s on s.player_id=f.player_id
  order by round(coalesce(s.xfp_next3_rounds,0),2) desc,f.player_name;
end;
$$;

revoke all on function public.get_fantasy_xfp_round_horizons_admin_v2(text) from public;
grant execute on function public.get_fantasy_xfp_round_horizons_admin_v2(text) to authenticated;
comment on function public.get_fantasy_xfp_round_horizons_admin_v2(text) is
  'MP-08 fast xFP horizons consuming canonical analysis features. Form model input remains Form 5; weights/scoring unchanged.';

notify pgrst,'reload schema';
