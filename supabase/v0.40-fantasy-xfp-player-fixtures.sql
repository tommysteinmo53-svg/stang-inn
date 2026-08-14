-- Stang Inn Fantasy Hockey – v0.40
-- Admin-only fixture breakdown for the next three xFP games for one player.
-- Uses the same weights and calculation logic as get_fantasy_xfp_admin_v1().
-- Read-only: does not alter Fantasy scoring, prices, squads or snapshots.

create or replace function get_fantasy_xfp_player_fixtures_admin_v1(
  p_player_id uuid,
  p_season text default '2026/27'
)
returns table(
  player_id uuid,
  game_id uuid,
  fixture_no integer,
  starts_at timestamptz,
  opponent text,
  is_home boolean,
  season_ppg numeric,
  form_ppg numeric,
  venue_ppg numeric,
  opponent_factor numeric,
  fixture_xfp numeric
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

  if p_season <> '2026/27' then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;

  if not exists(
    select 1
    from fantasy_players fp
    where fp.id=p_player_id
  ) then
    raise exception 'Fantasy player not found';
  end if;

  select
    s.season_weight,
    s.form_weight,
    s.venue_weight,
    s.opponent_weight
  into
    v_season_weight,
    v_form_weight,
    v_venue_weight,
    v_opponent_weight
  from fantasy_xfp_settings s
  where s.season=p_season;

  if not found then
    raise exception 'xFP settings missing for season %',p_season;
  end if;

  return query
  with target_player as (
    select fp.id,fp.team
    from fantasy_players fp
    where fp.id=p_player_id
  ),
  latest_points as (
    select distinct on(fpp.player_id,fpp.game_id)
      fpp.player_id,
      fpp.game_id,
      fpp.actual_points::numeric as actual_points,
      g.starts_at,
      g.home_team,
      g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where fpp.player_id=p_player_id
      and g.season=p_season
    order by
      fpp.player_id,
      fpp.game_id,
      fpp.calculated_at desc,
      fpp.id desc
  ),
  season_form as (
    select
      lp.player_id,
      avg(lp.actual_points)::numeric as season_ppg
    from latest_points lp
    group by lp.player_id
  ),
  ranked_form as (
    select
      lp.*,
      row_number() over(
        partition by lp.player_id
        order by lp.starts_at desc
      ) as rn
    from latest_points lp
  ),
  recent_form as (
    select
      rf.player_id,
      avg(rf.actual_points)::numeric as form_ppg
    from ranked_form rf
    where rf.rn<=5
    group by rf.player_id
  ),
  venue_splits as (
    select
      tp.id as player_id,
      avg(lp.actual_points) filter(where lp.home_team=tp.team)::numeric as home_ppg,
      avg(lp.actual_points) filter(where lp.away_team=tp.team)::numeric as away_ppg
    from target_player tp
    left join latest_points lp on lp.player_id=tp.id
    group by tp.id
  ),
  team_defense as (
    select
      club,
      avg(goals_against)::numeric as goals_against_pg
    from (
      select g.home_team as club,g.away_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season
        and g.home_score is not null
        and g.away_score is not null

      union all

      select g.away_team as club,g.home_score::numeric as goals_against
      from fantasy_games g
      where g.season=p_season
        and g.home_score is not null
        and g.away_score is not null
    ) x
    group by club
  ),
  league_defense as (
    select avg(td.goals_against_pg)::numeric as avg_ga
    from team_defense td
  ),
  upcoming_ranked as (
    select
      tp.id as player_id,
      g.id as game_id,
      g.starts_at,
      case
        when g.home_team=tp.team then g.away_team
        else g.home_team
      end as opponent,
      (g.home_team=tp.team) as is_home,
      row_number() over(order by g.starts_at,g.id)::integer as fixture_no
    from target_player tp
    join fantasy_games g
      on g.home_team=tp.team
      or g.away_team=tp.team
    where g.season=p_season
      and g.starts_at>now()
      and coalesce(g.status,'scheduled') not in('finished','cancelled')
  ),
  fixture_components as (
    select
      ur.player_id,
      ur.game_id,
      ur.fixture_no,
      ur.starts_at,
      ur.opponent,
      ur.is_home,
      coalesce(sf.season_ppg,0)::numeric as season_ppg,
      coalesce(rf.form_ppg,sf.season_ppg,0)::numeric as form_ppg,
      coalesce(
        case
          when ur.is_home then vs.home_ppg
          else vs.away_ppg
        end,
        sf.season_ppg,
        0
      )::numeric as venue_ppg,
      case
        when ld.avg_ga is null or ld.avg_ga=0 then 1::numeric
        when td.goals_against_pg is null then 1::numeric
        else greatest(
          0.80::numeric,
          least(1.20::numeric,td.goals_against_pg/ld.avg_ga)
        )
      end::numeric as opponent_factor
    from upcoming_ranked ur
    left join season_form sf on sf.player_id=ur.player_id
    left join recent_form rf on rf.player_id=ur.player_id
    left join venue_splits vs on vs.player_id=ur.player_id
    left join team_defense td on td.club=ur.opponent
    cross join league_defense ld
    where ur.fixture_no<=3
  )
  select
    fc.player_id,
    fc.game_id,
    fc.fixture_no,
    fc.starts_at,
    fc.opponent,
    fc.is_home,
    round(fc.season_ppg,2),
    round(fc.form_ppg,2),
    round(fc.venue_ppg,2),
    round(fc.opponent_factor,3),
    round(
      v_season_weight*fc.season_ppg
      + v_form_weight*fc.form_ppg
      + v_venue_weight*fc.venue_ppg
      + v_opponent_weight*(fc.season_ppg*fc.opponent_factor),
      2
    ) as fixture_xfp
  from fixture_components fc
  order by fc.fixture_no;
end;
$$;

revoke all on function get_fantasy_xfp_player_fixtures_admin_v1(uuid,text) from public;
grant execute on function get_fantasy_xfp_player_fixtures_admin_v1(uuid,text) to authenticated;

comment on function get_fantasy_xfp_player_fixtures_admin_v1(uuid,text) is
  'Admin-only read-only breakdown of one Fantasy player next three fixture-specific xFP calculations.';
