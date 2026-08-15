-- Stang Inn Fantasy Hockey – v0.52
-- Fast target-only baseline for preseason preview.
-- Replaces the v0.51 implementation without changing its RPC signature.
-- IMPORTANT: admin analysis only; production Fantasy scoring is untouched.

drop function if exists public.get_fantasy_xfp_baseline_players_admin_v1(uuid[],text);

create function public.get_fantasy_xfp_baseline_players_admin_v1(
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
  from fantasy_xfp_settings s
  where s.season=p_season;
  if not found then raise exception 'xFP settings missing for season %',p_season; end if;

  return query
  with
  target as materialized (
    select fp.id,fp.team,fp.position,sp.price::numeric price
    from fantasy_players fp
    join fantasy_player_season_prices sp
      on sp.player_id=fp.id and sp.season=p_season
    where fp.id=any(p_player_ids)
      and fp.active=true
      and fp.on_current_roster=true
      and sp.price is not null
  ),

  -- Only requested players are read from 2025/26 game stats.
  historical_target as materialized (
    select
      pgs.player_id,
      g.starts_at,
      g.home_team,
      g.away_team,
      coalesce(pgs.team_snapshot,t.team,'') stat_team,
      case when t.position in('C','W','F') then 'F' else t.position end normalized_pos,
      (
        case
          when coalesce(pgs.position_snapshot,t.position,'W')='G' then
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
            + coalesce(pgs.goals,0)*case when coalesce(pgs.position_snapshot,t.position,'W')='D' then 15 else 10 end
            + coalesce(pgs.assists,0)*case when coalesce(pgs.position_snapshot,t.position,'W')='D' then 8 else 6 end
            + coalesce(pgs.shots,0)
            + coalesce(pgs.plus_minus,0)
            - least(10,greatest(0,coalesce(pgs.pim,0)))
        end
      )::numeric fantasy_points
    from fantasy_player_game_stats pgs
    join fantasy_games g on g.id=pgs.game_id and g.season='2025/26'
    join target t on t.id=pgs.player_id
    where case
      when coalesce(pgs.position_snapshot,t.position,'W')='G'
        then coalesce(pgs.minutes_played,0)>0 or coalesce(pgs.saves,0)>0 or coalesce(pgs.goals_against,0)>0
      else coalesce(pgs.did_play,false)
    end
  ),
  historical_ranked as (
    select ht.*,row_number() over(partition by ht.player_id order by ht.starts_at desc) rn
    from historical_target ht
  ),
  historical_base as materialized (
    select ht.player_id,max(ht.normalized_pos) pos,count(*)::integer games,avg(ht.fantasy_points)::numeric season_ppg
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

  -- Cheap fallback for new players: median ppg/price among the requested players
  -- in the same normalized position. This avoids the league-wide scan in v0.51.
  target_position_prior as materialized (
    select hb.pos,
      percentile_cont(0.5) within group(order by hb.season_ppg/t.price)::numeric ppg_per_m
    from historical_base hb
    join target t on t.id=hb.player_id
    where hb.games>=5 and hb.season_ppg>0 and t.price>0
    group by hb.pos
  ),
  player_prior as materialized (
    select t.id player_id,
      coalesce(hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric season_ppg,
      coalesce(hf.form_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric form_ppg,
      coalesce(hv.home_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric home_ppg,
      coalesce(hv.away_ppg,hb.season_ppg,t.price*pp.ppg_per_m,0)::numeric away_ppg
    from target t
    left join historical_base hb on hb.player_id=t.id
    left join historical_form hf on hf.player_id=t.id
    left join historical_venue hv on hv.player_id=t.id
    left join target_position_prior pp
      on pp.pos=case when t.position in('C','W','F') then 'F' else t.position end
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
  blended as materialized (
    select t.id player_id,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.season_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cs.ppg,pp.season_ppg))::numeric season_ppg,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.form_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cf.ppg,cs.ppg,pp.form_ppg))::numeric form_ppg,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.home_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cv.home_ppg,cs.ppg,pp.home_ppg))::numeric home_ppg,
      ((1-least(1::numeric,coalesce(cs.games_scored,0)::numeric/10))*pp.away_ppg
        + least(1::numeric,coalesce(cs.games_scored,0)::numeric/10)*coalesce(cv.away_ppg,cs.ppg,pp.away_ppg))::numeric away_ppg
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
  unique_opponents as materialized (
    select distinct fantasy_team_key(nf.opponent) opponent_key,nf.opponent,nf.player_position
    from next_fixture nf
  ),
  opponent_factors as materialized (
    select uo.opponent_key,uo.player_position,
      fantasy_xfp_preseason_factor(uo.opponent)::numeric factor
    from unique_opponents uo
  )
  select nf.player_id,
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

revoke all on function public.get_fantasy_xfp_baseline_players_admin_v1(uuid[],text) from public;
grant execute on function public.get_fantasy_xfp_baseline_players_admin_v1(uuid[],text) to authenticated;

comment on function public.get_fantasy_xfp_baseline_players_admin_v1(uuid[],text) is
  'Admin-only fast target-only next-game xFP baseline for preseason preview. v0.52.';

notify pgrst, 'reload schema';
