-- Stang Inn Fantasy Hockey – v0.47
-- PRESEASON xFP SIGNAL (ADMIN ONLY)
-- Isolated analysis signal. Does NOT alter real Fantasy scoring.
--
-- Produces opponent-adjusted preseason PPG with confidence-aware weighting.
-- The effective preseason share is capped by fantasy_preseason_settings.max_weight
-- and fades to zero by fade_out_regular_games (10 by default).

create or replace function get_fantasy_preseason_signal_admin_v1(
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  player_name text,
  team text,
  player_position text,
  preseason_games integer,
  preseason_ppg numeric,
  avg_opponent_factor numeric,
  avg_data_weight numeric,
  regular_games integer,
  preseason_weight numeric,
  data_confidence text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists(
    select 1
    from players p
    where p.id=auth.uid()
      and p.admin=true
  ) then
    raise exception 'Admin only';
  end if;

  return query
  with cfg as (
    select
      s.max_weight::numeric as max_weight,
      s.games_for_full_weight::numeric as games_for_full_weight,
      s.fade_out_regular_games::numeric as fade_out_regular_games
    from fantasy_preseason_settings s
    where s.season=p_season
  ),

  current_games as (
    select
      fpp.player_id,
      count(distinct fpp.game_id)::integer as games
    from fantasy_player_points fpp
    join fantasy_games g
      on g.id=fpp.game_id
    where g.season=p_season
    group by fpp.player_id
  ),

  scored as (
    select
      ps.player_id,
      fp.name as player_name,
      fp.team,
      fp.position as player_position,
      pg.id as preseason_game_id,

      case
        when fantasy_team_key(ps.team)=fantasy_team_key(pg.home_team)
          then coalesce(away_strength.strength_factor,1.0)
        when fantasy_team_key(ps.team)=fantasy_team_key(pg.away_team)
          then coalesce(home_strength.strength_factor,1.0)
        else 1.0
      end::numeric as opponent_factor,

      least(
        1::numeric,
        greatest(
          0.10::numeric,
          coalesce(ps.source_quality,0.50)::numeric
          *
          case
            when ps.source_type='hockeylive' then 0.95
            when coalesce(ps.position,fp.position)='G'
              and coalesce(ps.minutes_played,0)>0
              and (coalesce(ps.saves,0)>0 or coalesce(ps.goals_against,0)>0)
              then 1.00
            when (ps.raw->'knownFields') ? 'goals'
              and (ps.raw->'knownFields') ? 'assists'
              and (
                (ps.raw->'knownFields') ? 'pim'
                or (ps.raw->'knownFields') ? 'shots'
                or (ps.raw->'knownFields') ? 'plusMinus'
              )
              then 0.75
            when (ps.raw->'knownFields') ? 'goals'
              or (ps.raw->'knownFields') ? 'assists'
              or (ps.raw->'knownFields') ? 'pim'
              then 0.60
            when (ps.raw->'knownFields') ? 'lineup'
              then 0.35
            else 0.50
          end
        )
      )::numeric as data_weight,

      (
        case
          when coalesce(ps.position,fp.position)='G' then
            case when coalesce(ps.did_play,false) then 2 else 0 end
            + coalesce(ps.goals,0)*15
            + coalesce(ps.assists,0)*8
            + coalesce(ps.shots,0)
            + coalesce(ps.plus_minus,0)
            - least(10,greatest(0,coalesce(ps.pim,0)))
            + coalesce(ps.saves,0)/2.0
            - coalesce(ps.goals_against,0)*3
            + case when coalesce(ps.shutout,false) then 10 else 0 end
            + case when coalesce(ps.win,false) then 5 else 0 end
          else
            case when coalesce(ps.did_play,false) then 2 else 0 end
            + coalesce(ps.goals,0)
              * case when coalesce(ps.position,fp.position)='D' then 15 else 10 end
            + coalesce(ps.assists,0)
              * case when coalesce(ps.position,fp.position)='D' then 8 else 6 end
            + coalesce(ps.shots,0)
            + coalesce(ps.plus_minus,0)
            - least(10,greatest(0,coalesce(ps.pim,0)))
        end
      )::numeric as raw_fantasy_points

    from fantasy_preseason_player_stats ps
    join fantasy_preseason_games pg
      on pg.id=ps.preseason_game_id
      and pg.season=p_season
      and pg.status='finished'
    join fantasy_players fp
      on fp.id=ps.player_id
    left join fantasy_preseason_league_strength home_strength
      on home_strength.league_code=pg.home_league_code
    left join fantasy_preseason_league_strength away_strength
      on away_strength.league_code=pg.away_league_code
    where ps.player_id is not null
      and coalesce(ps.did_play,false)=true
  ),

  agg as (
    select
      s.player_id,
      max(s.player_name) as player_name,
      max(s.team) as team,
      max(s.player_position) as player_position,
      count(distinct s.preseason_game_id)::integer as preseason_games,
      (
        sum(s.raw_fantasy_points*s.opponent_factor*s.data_weight)
        /
        nullif(sum(s.data_weight),0)
      )::numeric as preseason_ppg,
      (
        sum(s.opponent_factor*s.data_weight)
        /
        nullif(sum(s.data_weight),0)
      )::numeric as avg_opponent_factor,
      avg(s.data_weight)::numeric as avg_data_weight
    from scored s
    group by s.player_id
  )

  select
    a.player_id,
    a.player_name,
    a.team,
    a.player_position,
    a.preseason_games,
    round(a.preseason_ppg,2),
    round(a.avg_opponent_factor,3),
    round(a.avg_data_weight,3),
    coalesce(cg.games,0)::integer,

    round(
      greatest(
        0::numeric,
        least(
          cfg.max_weight,
          cfg.max_weight
          * least(1::numeric,a.preseason_games::numeric/nullif(cfg.games_for_full_weight,0))
          * greatest(0::numeric,1-(coalesce(cg.games,0)::numeric/nullif(cfg.fade_out_regular_games,0)))
        )
      ),
      4
    ) as preseason_weight,

    case
      when a.preseason_games>=4 and a.avg_data_weight>=0.80 then 'high'
      when a.preseason_games>=2 and a.avg_data_weight>=0.55 then 'medium'
      else 'low'
    end as data_confidence

  from agg a
  cross join cfg
  left join current_games cg
    on cg.player_id=a.player_id
  order by a.preseason_ppg desc,a.player_name;
end;
$$;

revoke all on function get_fantasy_preseason_signal_admin_v1(text) from public;
grant execute on function get_fantasy_preseason_signal_admin_v1(text) to authenticated;

comment on function get_fantasy_preseason_signal_admin_v1(text) is
  'Admin-only preseason xFP signal: fantasy production adjusted for opponent league strength, source/data quality and sample size. Fades to zero after configured regular-season games.';
