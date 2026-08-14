-- Stang Inn Fantasy Hockey – v0.45
-- Preseason / early-season xFP blend.
-- 0 games: 100% 2025/26 baseline.
-- 1-9 games: linear blend toward 2026/27.
-- 10+ games: 100% 2026/27.
-- Historical baseline is recomputed from validated 2025/26 game stats using the current core fantasy scoring.
-- Players without 2025/26 EHL game data receive a conservative position-specific price prior.
-- Admin analysis only; never changes actual Fantasy scoring.

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
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=auth.uid() and p.admin=true) then raise exception 'Admin only'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  select s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight
  into v_season_weight,v_form_weight,v_venue_weight,v_opponent_weight
  from fantasy_xfp_settings s where s.season=p_season;
  if not found then raise exception 'xFP settings missing for season %',p_season; end if;

  return query
  with current_latest as (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,fpp.game_id,fpp.actual_points::numeric actual_points,
      g.starts_at,g.home_team,g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where g.season=p_season
    order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ),
  current_season as (
    select cl.player_id,count(*)::integer games_scored,avg(cl.actual_points)::numeric ppg
    from current_latest cl group by cl.player_id
  ),
  current_ranked as (
    select cl.*,row_number() over(partition by cl.player_id order by cl.starts_at desc) rn
    from current_latest cl
  ),
  current_form as (
    select cr.player_id,avg(cr.actual_points)::numeric ppg
    from current_ranked cr where cr.rn<=5 group by cr.player_id
  ),
  current_venue as (
    select fp.id player_id,
      avg(cl.actual_points) filter(where fantasy_team_key(cl.home_team)=fantasy_team_key(fp.team))::numeric home_ppg,
      avg(cl.actual_points) filter(where fantasy_team_key(cl.away_team)=fantasy_team_key(fp.team))::numeric away_ppg
    from fantasy_players fp left join current_latest cl on cl.player_id=fp.id
    group by fp.id
  ),

  historical_game_points as (
    select
      pgs.player_id,
      pgs.game_id,
      g.starts_at,
      g.home_team,
      g.away_team,
      coalesce(pgs.team_snapshot,fp.team,'') as stat_team,
      (
        case
          when coalesce(pgs.position_snapshot,fp.position,'W')='G' then
            case when coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0 then 2 else 0 end
            + coalesce(pgs.goals,0)*15
            + coalesce(pgs.assists,0)*8
            + coalesce(pgs.shots,0)
            + coalesce(pgs.plus_minus,0)
            - least(10,greatest(0,coalesce(pgs.pim,0)))
            + coalesce(pgs.saves,0)/2.0
            - coalesce(pgs.goals_against,0)*3
            + case when coalesce(pgs.shutout,false) then 10 else 0 end
            + case when coalesce(pgs.win,false) then 5 else 0 end
          else
            case when coalesce(pgs.did_play,false) then 2 else 0 end
            + coalesce(pgs.goals,0)*case when coalesce(pgs.position_snapshot,fp.position,'W')='D' then 15 else 10 end
            + coalesce(pgs.assists,0)*case when coalesce(pgs.position_snapshot,fp.position,'W')='D' then 8 else 6 end
            + coalesce(pgs.shots,0)
            + coalesce(pgs.plus_minus,0)
            - least(10,greatest(0,coalesce(pgs.pim,0)))
        end
      )::numeric as fantasy_points
    from fantasy_player_game_stats pgs
    join fantasy_games g on g.id=pgs.game_id and g.season='2025/26'
    join fantasy_players fp on fp.id=pgs.player_id
    where case
      when coalesce(pgs.position_snapshot,fp.position,'W')='G'
        then coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0
      else coalesce(pgs.did_play,false)
    end
  ),
  historical_ranked as (
    select hp.*,row_number() over(partition by hp.player_id order by hp.starts_at desc) rn
    from historical_game_points hp
  ),
  historical_base as (
    select hp.player_id,count(*)::integer games,avg(hp.fantasy_points)::numeric season_ppg
    from historical_game_points hp group by hp.player_id
  ),
  historical_form as (
    select hr.player_id,avg(hr.fantasy_points)::numeric form_ppg
    from historical_ranked hr where hr.rn<=5 group by hr.player_id
  ),
  historical_venue as (
    select hp.player_id,
      avg(hp.fantasy_points) filter(where fantasy_team_key(hp.home_team)=fantasy_team_key(hp.stat_team))::numeric home_ppg,
      avg(hp.fantasy_points) filter(where fantasy_team_key(hp.away_team)=fantasy_team_key(hp.stat_team))::numeric away_ppg
    from historical_game_points hp group by hp.player_id
  ),
  historical_priced as (
    select hb.player_id,
      case when fp.position in('C','W','F') then 'F' else fp.position end pos,
      sp.price,hb.season_ppg
    from historical_base hb join fantasy_players fp on fp.id=hb.player_id
    join fantasy_player_season_prices sp on sp.player_id=hb.player_id and sp.season=p_season
    where sp.price>0 and hb.games>=5 and hb.season_ppg>0
  ),
  position_price_prior as (
    select hp.pos,percentile_cont(0.5) within group(order by hp.season_ppg/hp.price)::numeric ppg_per_m
    from historical_priced hp group by hp.pos
  ),
  player_prior as (
    select fp.id player_id,
      coalesce(hb.games,0)::integer historical_games,
      coalesce(hb.season_ppg,sp.price*pp.ppg_per_m,0)::numeric prior_season_ppg,
      coalesce(hf.form_ppg,hb.season_ppg,sp.price*pp.ppg_per_m,0)::numeric prior_form_ppg,
      coalesce(hv.home_ppg,hb.season_ppg,sp.price*pp.ppg_per_m,0)::numeric prior_home_ppg,
      coalesce(hv.away_ppg,hb.season_ppg,sp.price*pp.ppg_per_m,0)::numeric prior_away_ppg
    from fantasy_players fp
    join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
    left join historical_base hb on hb.player_id=fp.id
    left join historical_form hf on hf.player_id=fp.id
    left join historical_venue hv on hv.player_id=fp.id
    left join position_price_prior pp on pp.pos=case when fp.position in('C','W','F') then 'F' else fp.position end
  ),
  blended as (
    select fp.id player_id,
      coalesce(cs.games_scored,0)::integer games_scored,
      least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric) current_weight,
      pp.historical_games,
      (
        (1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric))*pp.prior_season_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric)*coalesce(cs.ppg,pp.prior_season_ppg)
      )::numeric season_ppg,
      (
        (1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric))*pp.prior_form_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric)*coalesce(cf.ppg,cs.ppg,pp.prior_form_ppg)
      )::numeric form_ppg,
      (
        (1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric))*pp.prior_home_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric)*coalesce(cv.home_ppg,cs.ppg,pp.prior_home_ppg)
      )::numeric home_ppg,
      (
        (1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric))*pp.prior_away_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10::numeric)*coalesce(cv.away_ppg,cs.ppg,pp.prior_away_ppg)
      )::numeric away_ppg
    from fantasy_players fp
    join player_prior pp on pp.player_id=fp.id
    left join current_season cs on cs.player_id=fp.id
    left join current_form cf on cf.player_id=fp.id
    left join current_venue cv on cv.player_id=fp.id
  ),
  upcoming_ranked as (
    select fp.id player_id,fp.position player_position,g.id game_id,g.starts_at,
      case when fantasy_team_key(g.home_team)=fantasy_team_key(fp.team) then g.away_team else g.home_team end opponent,
      (fantasy_team_key(g.home_team)=fantasy_team_key(fp.team)) is_home,
      row_number() over(partition by fp.id order by g.starts_at,g.id) rn
    from fantasy_players fp
    join fantasy_games g on fantasy_team_key(g.home_team)=fantasy_team_key(fp.team) or fantasy_team_key(g.away_team)=fantasy_team_key(fp.team)
    where g.season=p_season and g.starts_at>now() and coalesce(g.status,'scheduled') not in('finished','cancelled')
  ),
  fixture_components as (
    select ur.player_id,ur.game_id,ur.starts_at,ur.opponent,ur.is_home,ur.rn,
      b.games_scored,b.historical_games,b.season_ppg,b.form_ppg,
      case when ur.is_home then b.home_ppg else b.away_ppg end::numeric fixture_venue_ppg,
      fantasy_xfp_opponent_factor(ur.opponent,ur.player_position,p_season)::numeric fixture_opponent_factor
    from upcoming_ranked ur join blended b on b.player_id=ur.player_id
    where ur.rn<=3
  ),
  fixture_xfp as (
    select fc.*,
      (v_season_weight*fc.season_ppg
       +v_form_weight*fc.form_ppg
       +v_venue_weight*fc.fixture_venue_ppg
       +v_opponent_weight*(fc.season_ppg*fc.fixture_opponent_factor))::numeric fixture_xfp
    from fixture_components fc
  ),
  next_fixture as (
    select fx.player_id,fx.starts_at,fx.opponent,fx.is_home,fx.fixture_venue_ppg venue_ppg,
      fx.fixture_opponent_factor opponent_factor,fx.fixture_xfp xfp_next_game
    from fixture_xfp fx where fx.rn=1
  ),
  next3_summary as (
    select fx.player_id,count(*)::integer next3_games,sum(fx.fixture_xfp)::numeric xfp_next3
    from fixture_xfp fx group by fx.player_id
  )
  select fp.id,fp.name,fp.team,fp.position,sp.price::numeric,
    b.games_scored,
    round(b.season_ppg,2),round(b.form_ppg,2),round(coalesce(nf.venue_ppg,b.season_ppg),2),
    nf.opponent,nf.starts_at,nf.is_home,round(coalesce(nf.opponent_factor,1),3),
    coalesce(n3.next3_games,0),round(coalesce(nf.xfp_next_game,0),2),round(coalesce(n3.xfp_next3,0),2),
    case when sp.price>0 then round(coalesce(n3.xfp_next3,0)/sp.price,3) else 0::numeric end,
    case
      when b.games_scored>=10 then 'high'
      when b.games_scored>=5 then 'high'
      when b.historical_games>=10 then 'medium'
      when b.historical_games>=5 then 'medium'
      else 'low'
    end
  from fantasy_players fp
  join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
  join blended b on b.player_id=fp.id
  left join next_fixture nf on nf.player_id=fp.id
  left join next3_summary n3 on n3.player_id=fp.id
  where fp.active=true and fp.on_current_roster=true and sp.price is not null
  order by xfp_next_game desc,fp.name;
end;
$$;

revoke all on function get_fantasy_xfp_admin_v1(text) from public;
grant execute on function get_fantasy_xfp_admin_v1(text) to authenticated;

comment on function get_fantasy_xfp_admin_v1(text) is
  'Admin xFP v2: 2025/26 historical baseline blended linearly into 2026/27 through game 9; game 10+ uses only current-season data.';
