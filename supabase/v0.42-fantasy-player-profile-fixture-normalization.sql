-- Stang Inn Fantasy Hockey – v0.42
-- Fix upcoming games on Fantasy player profiles by normalizing
-- short Fantasy team names against HockeyLive full team names.
-- Read-only profile behavior otherwise remains unchanged.

create or replace function fantasy_team_key(p_team text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(coalesce(p_team,''));
begin
  if v like '%frisk asker%' then return 'frisk'; end if;
  if v like '%lillehammer%' then return 'lillehammer'; end if;
  if v like '%lørenskog%' then return 'lorenskog'; end if;
  if v like '%narvik%' then return 'narvik'; end if;
  if v like '%nidaros%' then return 'nidaros'; end if;
  if v like '%ringerike%' then return 'ringerike'; end if;
  if v like '%sparta%' then return 'sparta'; end if;
  if v like '%stavanger%' then return 'stavanger'; end if;
  if v like '%stjernen%' then return 'stjernen'; end if;
  if v like '%storhamar%' then return 'storhamar'; end if;
  if v like '%vålerenga%' then return 'valerenga'; end if;
  return trim(v);
end;
$$;

create or replace function get_fantasy_player_profile_v1(
  p_player_id uuid,
  p_season text default '2026/27'
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_player fantasy_players%rowtype;
  v_price numeric;
  v_total_teams integer:=0;
  v_owner_teams integer:=0;
  v_ownership numeric:=0;
  v_stats jsonb;
  v_points jsonb;
  v_form jsonb;
  v_upcoming jsonb;
  v_history jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_season<>'2026/27' then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;

  select * into v_player
  from fantasy_players fp
  where fp.id=p_player_id;

  if not found then
    raise exception 'Fantasy player not found';
  end if;

  select sp.price
  into v_price
  from fantasy_player_season_prices sp
  where sp.season=p_season
    and sp.player_id=p_player_id;

  select count(*)::integer
  into v_total_teams
  from fantasy_user_teams t
  where t.season=p_season;

  select count(distinct tp.team_id)::integer
  into v_owner_teams
  from fantasy_user_team_players tp
  join fantasy_user_teams t on t.id=tp.team_id
  where t.season=p_season
    and tp.player_id=p_player_id;

  if v_total_teams>0 then
    v_ownership:=round((v_owner_teams::numeric/v_total_teams::numeric)*100,1);
  end if;

  select jsonb_build_object(
    'games',count(*)::integer,
    'goals',coalesce(sum(pgs.goals),0)::integer,
    'assists',coalesce(sum(pgs.assists),0)::integer,
    'points',coalesce(sum(pgs.goals+pgs.assists),0)::integer,
    'shots',coalesce(sum(pgs.shots),0)::integer,
    'plusMinus',coalesce(sum(pgs.plus_minus),0)::integer,
    'pim',coalesce(sum(pgs.pim),0)::integer,
    'powerplayGoals',coalesce(sum(pgs.powerplay_goals),0)::integer,
    'shorthandedGoals',coalesce(sum(pgs.shorthanded_goals),0)::integer,
    'gameWinningGoals',coalesce(sum(pgs.game_winning_goals),0)::integer,
    'saves',coalesce(sum(pgs.saves),0)::integer,
    'goalsAgainst',coalesce(sum(pgs.goals_against),0)::integer,
    'wins',count(*) filter(where pgs.win=true)::integer,
    'shutouts',count(*) filter(where pgs.shutout=true)::integer,
    'minutesPlayed',coalesce(round(sum(pgs.minutes_played),2),0)
  ) into v_stats
  from fantasy_player_game_stats pgs
  join fantasy_games g on g.id=pgs.game_id
  where pgs.player_id=p_player_id
    and g.season=p_season;

  with latest_points as (
    select distinct on(fpp.game_id)
      fpp.game_id,
      fpp.actual_points,
      fpp.breakdown,
      fpp.calculated_at
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where fpp.player_id=p_player_id
      and g.season=p_season
    order by fpp.game_id,fpp.calculated_at desc,fpp.id desc
  )
  select jsonb_build_object(
    'total',coalesce(sum(lp.actual_points),0),
    'average',coalesce(round(avg(lp.actual_points),2),0),
    'gamesScored',count(*)::integer
  ) into v_points
  from latest_points lp;

  with latest_points as (
    select distinct on(fpp.game_id)
      fpp.game_id,
      fpp.actual_points,
      g.starts_at,
      g.home_team,
      g.away_team
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where fpp.player_id=p_player_id
      and g.season=p_season
    order by fpp.game_id,fpp.calculated_at desc,fpp.id desc
  ), last_five as (
    select * from latest_points
    order by starts_at desc
    limit 5
  )
  select jsonb_build_object(
    'games',count(*)::integer,
    'points',coalesce(sum(actual_points),0),
    'average',coalesce(round(avg(actual_points),2),0)
  ) into v_form
  from last_five;

  select coalesce(jsonb_agg(jsonb_build_object(
    'gameId',q.id,
    'startsAt',q.starts_at,
    'homeTeam',q.home_team,
    'awayTeam',q.away_team,
    'opponent',case
      when fantasy_team_key(q.home_team)=fantasy_team_key(v_player.team)
        then q.away_team
      else q.home_team
    end,
    'home',fantasy_team_key(q.home_team)=fantasy_team_key(v_player.team),
    'roundNo',q.round_no,
    'status',q.status
  ) order by q.starts_at),'[]'::jsonb)
  into v_upcoming
  from (
    select g.*
    from fantasy_games g
    where g.season=p_season
      and (
        fantasy_team_key(g.home_team)=fantasy_team_key(v_player.team)
        or fantasy_team_key(g.away_team)=fantasy_team_key(v_player.team)
      )
      and g.starts_at>now()
      and coalesce(g.status,'scheduled') not in ('finished','cancelled')
    order by g.starts_at
    limit 5
  ) q;

  with latest_points as (
    select distinct on(fpp.game_id)
      fpp.game_id,
      fpp.actual_points,
      fpp.breakdown,
      fpp.calculated_at,
      g.starts_at,
      g.home_team,
      g.away_team,
      g.round_no
    from fantasy_player_points fpp
    join fantasy_games g on g.id=fpp.game_id
    where fpp.player_id=p_player_id
      and g.season=p_season
    order by fpp.game_id,fpp.calculated_at desc,fpp.id desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'gameId',h.game_id,
    'startsAt',h.starts_at,
    'homeTeam',h.home_team,
    'awayTeam',h.away_team,
    'roundNo',h.round_no,
    'fantasyPoints',h.actual_points,
    'breakdown',coalesce(h.breakdown,'{}'::jsonb)
  ) order by h.starts_at desc),'[]'::jsonb)
  into v_history
  from (
    select * from latest_points
    order by starts_at desc
    limit 20
  ) h;

  return jsonb_build_object(
    'player',jsonb_build_object(
      'id',v_player.id,
      'name',v_player.name,
      'team',v_player.team,
      'position',v_player.position,
      'active',v_player.active,
      'onCurrentRoster',v_player.on_current_roster,
      'availableForPurchase',v_player.available_for_purchase,
      'price',v_price
    ),
    'fantasy',coalesce(v_points,'{}'::jsonb),
    'form',coalesce(v_form,'{}'::jsonb),
    'stats',coalesce(v_stats,'{}'::jsonb),
    'ownership',jsonb_build_object(
      'percent',v_ownership,
      'ownerTeams',v_owner_teams,
      'totalTeams',v_total_teams
    ),
    'upcoming',coalesce(v_upcoming,'[]'::jsonb),
    'history',coalesce(v_history,'[]'::jsonb)
  );
end;
$$;

revoke all on function fantasy_team_key(text) from public;
revoke all on function get_fantasy_player_profile_v1(uuid,text) from public;
grant execute on function get_fantasy_player_profile_v1(uuid,text) to authenticated;

comment on function get_fantasy_player_profile_v1(uuid,text) is
  'Read-only Fantasy player profile aggregate with normalized HockeyLive/Fantasy team matching for upcoming fixtures.';
