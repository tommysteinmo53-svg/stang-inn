-- Stang Inn Fantasy Hockey – v0.51
-- Targeted xFP baseline for preseason preview.
-- Computes only next-game xFP for requested players and calculates opponent factors set-wise.
-- Preserves the v0.45 2025/26 -> 2026/27 blend and v0.43 dynamic opponent-factor logic.
-- Admin analysis only; does not alter production Fantasy scoring.
-- Safe repair: drop any earlier incorrectly-created signature before recreating.

drop function if exists public.get_fantasy_xfp_baseline_players_admin_v1(uuid[],text);

create or replace function get_fantasy_xfp_baseline_players_admin_v1(
  p_player_ids uuid[],
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  xfp_next_game numeric
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
  if coalesce(array_length(p_player_ids,1),0)=0 then return; end if;

  select s.season_weight,s.form_weight,s.venue_weight,s.opponent_weight
  into v_season_weight,v_form_weight,v_venue_weight,v_opponent_weight
  from fantasy_xfp_settings s where s.season=p_season;
  if not found then raise exception 'xFP settings missing for season %',p_season; end if;

  return query
  with
  target as materialized (
    select fp.id,fp.team,fp.position,sp.price::numeric price
    from fantasy_players fp
    join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season
    where fp.id=any(p_player_ids)
      and fp.active=true
      and fp.on_current_roster=true
      and sp.price is not null
  ),
  current_latest as materialized (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,fpp.game_id,fpp.actual_points::numeric actual_points,
      g.starts_at,g.home_team,g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    join target t on t.id=fpp.player_id
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
    select t.id player_id,
      avg(cl.actual_points) filter(where fantasy_team_key(cl.home_team)=fantasy_team_key(t.team))::numeric home_ppg,
      avg(cl.actual_points) filter(where fantasy_team_key(cl.away_team)=fantasy_team_key(t.team))::numeric away_ppg
    from target t left join current_latest cl on cl.player_id=t.id
    group by t.id
  ),
  historical_all as materialized (
    select
      pgs.player_id,
      pgs.game_id,
      g.starts_at,
      g.home_team,
      g.away_team,
      coalesce(pgs.team_snapshot,fp.team,'') stat_team,
      case when fp.position in('C','W','F') then 'F' else fp.position end normalized_pos,
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
      )::numeric fantasy_points
    from fantasy_player_game_stats pgs
    join fantasy_games g on g.id=pgs.game_id and g.season='2025/26'
    join fantasy_players fp on fp.id=pgs.player_id
    where case
      when coalesce(pgs.position_snapshot,fp.position,'W')='G'
        then coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0
      else coalesce(pgs.did_play,false)
    end
  ),
  historical_base_all as materialized (
    select ha.player_id,max(ha.normalized_pos) pos,count(*)::integer games,avg(ha.fantasy_points)::numeric season_ppg
    from historical_all ha group by ha.player_id
  ),
  historical_priced as (
    select hb.player_id,hb.pos,sp.price,hb.season_ppg
    from historical_base_all hb
    join fantasy_player_season_prices sp on sp.player_id=hb.player_id and sp.season=p_season
    where sp.price>0 and hb.games>=5 and hb.season_ppg>0
  ),
  position_price_prior as materialized (
    select hp.pos,percentile_cont(0.5) within group(order by hp.season_ppg/hp.price)::numeric ppg_per_m
    from historical_priced hp group by hp.pos
  ),
  historical_target as materialized (
    select ha.* from historical_all ha join target t on t.id=ha.player_id
  ),
  historical_ranked as (
    select ht.*,row_number() over(partition by ht.player_id order by ht.starts_at desc) rn
    from historical_target ht
  ),
  historical_base as (
    select ht.player_id,count(*)::integer games,avg(ht.fantasy_points)::numeric season_ppg
    from historical_target ht group by ht.player_id
  ),
  historical_form as (
    select hr.player_id,avg(hr.fantasy_points)::numeric form_ppg
    from historical_ranked hr where hr.rn<=5 group by hr.player_id
  ),
  historical_venue as (
    select ht.player_id,
      avg(ht.fantasy_points) filter(where fantasy_team_key(ht.home_team)=fantasy_team_key(ht.stat_team))::numeric home_ppg,
      avg(ht.fantasy_points) filter(where fantasy_team_key(ht.away_team)=fantasy_team_key(ht.stat_team))::numeric away_ppg
    from historical_target ht group by ht.player_id
  ),
  player_prior as (
    select t.id player_id,
      coalesce(hb.games,0)::integer historical_games,
      coalesce(hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric prior_season_ppg,
      coalesce(hf.form_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric prior_form_ppg,
      coalesce(hv.home_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric prior_home_ppg,
      coalesce(hv.away_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric prior_away_ppg
    from target t
    left join historical_base hb on hb.player_id=t.id
    left join historical_form hf on hf.player_id=t.id
    left join historical_venue hv on hv.player_id=t.id
    left join position_price_prior pp on pp.pos=case when t.position in('C','W','F') then 'F' else t.position end
  ),
  blended as materialized (
    select t.id player_id,
      coalesce(cs.games_scored,0)::integer games_scored,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.prior_season_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cs.ppg,pp.prior_season_ppg))::numeric season_ppg,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.prior_form_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cf.ppg,cs.ppg,pp.prior_form_ppg))::numeric form_ppg,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.prior_home_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cv.home_ppg,cs.ppg,pp.prior_home_ppg))::numeric home_ppg,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.prior_away_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cv.away_ppg,cs.ppg,pp.prior_away_ppg))::numeric away_ppg
    from target t
    join player_prior pp on pp.player_id=t.id
    left join current_season cs on cs.player_id=t.id
    left join current_form cf on cf.player_id=t.id
    left join current_venue cv on cv.player_id=t.id
  ),
  next_fixture as materialized (
    select distinct on(t.id)
      t.id player_id,t.position player_position,g.starts_at,
      case when fantasy_team_key(g.home_team)=fantasy_team_key(t.team) then g.away_team else g.home_team end opponent,
      (fantasy_team_key(g.home_team)=fantasy_team_key(t.team)) is_home
    from target t
    join fantasy_games g
      on fantasy_team_key(g.home_team)=fantasy_team_key(t.team)
      or fantasy_team_key(g.away_team)=fantasy_team_key(t.team)
    where g.season=p_season
      and g.starts_at>now()
      and coalesce(g.status,'scheduled') not in('finished','cancelled')
    order by t.id,g.starts_at,g.id
  ),
  league_goal_rows as materialized (
    select g.home_score::numeric goals from fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
    union all
    select g.away_score::numeric from fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
  ),
  league_avg as materialized (
    select avg(lgr.goals)::numeric league_goals from league_goal_rows lgr
  ),
  team_game_rows as materialized (
    select fantasy_team_key(g.home_team) team_key,g.home_score::numeric gf,g.away_score::numeric ga
    from fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
    union all
    select fantasy_team_key(g.away_team),g.away_score::numeric,g.home_score::numeric
    from fantasy_games g
    where g.season=p_season and g.home_score is not null and g.away_score is not null
  ),
  team_live as materialized (
    select tgr.team_key,count(*)::integer games,avg(tgr.gf)::numeric gf,avg(tgr.ga)::numeric ga
    from team_game_rows tgr group by tgr.team_key
  ),
  unique_opponents as materialized (
    select distinct fantasy_team_key(nf.opponent) opponent_key,nf.opponent,nf.player_position
    from next_fixture nf
  ),
  opponent_factors as materialized (
    select uo.opponent_key,uo.player_position,
      round(greatest(0.70::numeric,least(1.35::numeric,
        (1-least(1::numeric,coalesce(tl.games,0)::numeric/12))*fantasy_xfp_preseason_factor(uo.opponent)
        + least(1::numeric,coalesce(tl.games,0)::numeric/12)*
          case
            when coalesce(tl.games,0)=0 or la.league_goals is null or la.league_goals<=0
              then fantasy_xfp_preseason_factor(uo.opponent)
            when uo.player_position='G' then
              greatest(0.70::numeric,least(1.35::numeric,
                case when coalesce(tl.gf,0)>0 then power(la.league_goals/tl.gf,1.15) else 1.35::numeric end))
            else
              greatest(0.70::numeric,least(1.35::numeric,
                case when tl.ga is not null then power(tl.ga/la.league_goals,1.15) else 1::numeric end))
          end
      )),3) factor
    from unique_opponents uo
    left join team_live tl on tl.team_key=uo.opponent_key
    cross join league_avg la
  )
  select
    nf.player_id,
    round(
      v_season_weight*b.season_ppg
      + v_form_weight*b.form_ppg
      + v_venue_weight*(case when nf.is_home then b.home_ppg else b.away_ppg end)
      + v_opponent_weight*(b.season_ppg*coalesce(ofc.factor,1)),
      2
    )::numeric xfp_next_game
  from next_fixture nf
  join blended b on b.player_id=nf.player_id
  left join opponent_factors ofc
    on ofc.opponent_key=fantasy_team_key(nf.opponent)
   and ofc.player_position=nf.player_position;
end;
$$;

revoke all on function get_fantasy_xfp_baseline_players_admin_v1(uuid[],text) from public;
grant execute on function get_fantasy_xfp_baseline_players_admin_v1(uuid[],text) to authenticated;

comment on function get_fantasy_xfp_baseline_players_admin_v1(uuid[],text) is
  'Admin-only targeted next-game xFP baseline. Preserves v0.45 blend and v0.43 opponent factors while avoiding full-pool/three-fixture recomputation.';

notify pgrst, 'reload schema';
