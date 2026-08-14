-- Stang Inn Fantasy Hockey – v0.23
-- Season leaderboard, round leaderboard and team history.
-- Source of truth remains fantasy_team_round_points: no duplicated season total is stored.
-- Test rounds (round_no >= 9000) are excluded everywhere.

-- ============================================================
-- 1. SEASON LEADERBOARD
-- Includes registered fantasy teams even before they have a scored round.
-- Equal total points share the same standings position.
-- ============================================================

drop function if exists get_fantasy_season_leaderboard(text);

create function get_fantasy_season_leaderboard(
  p_season text
)
returns table(
  standings_position bigint,
  team_id uuid,
  user_id uuid,
  team_name text,
  total_points numeric,
  rounds_scored bigint,
  round_wins bigint,
  best_round_points numeric,
  average_round_points numeric,
  last_round_no integer,
  last_round_points numeric
)
language sql
stable
security definer
set search_path=public
as $$
  with real_results as (
    select
      trp.team_id,
      trp.user_id,
      trp.round_id,
      r.round_no,
      trp.total_points,
      dense_rank() over(
        partition by trp.round_id
        order by trp.total_points desc
      ) as round_rank
    from fantasy_team_round_points trp
    join fantasy_rounds r on r.id=trp.round_id
    where trp.season=p_season
      and r.season=p_season
      and r.round_no<9000
  ),
  aggregates as (
    select
      rr.team_id,
      sum(rr.total_points)::numeric as total_points,
      count(*)::bigint as rounds_scored,
      count(*) filter(where rr.round_rank=1)::bigint as round_wins,
      max(rr.total_points)::numeric as best_round_points,
      round(avg(rr.total_points),2)::numeric as average_round_points
    from real_results rr
    group by rr.team_id
  ),
  latest as (
    select x.team_id,x.round_no,x.total_points
    from (
      select
        rr.team_id,
        rr.round_no,
        rr.total_points,
        row_number() over(
          partition by rr.team_id
          order by rr.round_no desc,rr.round_id desc
        ) as rn
      from real_results rr
    ) x
    where x.rn=1
  ),
  teams as (
    select
      t.id as team_id,
      t.user_id,
      t.name as team_name,
      coalesce(a.total_points,0)::numeric as total_points,
      coalesce(a.rounds_scored,0)::bigint as rounds_scored,
      coalesce(a.round_wins,0)::bigint as round_wins,
      coalesce(a.best_round_points,0)::numeric as best_round_points,
      coalesce(a.average_round_points,0)::numeric as average_round_points,
      l.round_no as last_round_no,
      l.total_points::numeric as last_round_points
    from fantasy_user_teams t
    left join aggregates a on a.team_id=t.id
    left join latest l on l.team_id=t.id
    where t.season=p_season
  )
  select
    dense_rank() over(order by teams.total_points desc) as standings_position,
    teams.team_id,
    teams.user_id,
    teams.team_name,
    teams.total_points,
    teams.rounds_scored,
    teams.round_wins,
    teams.best_round_points,
    teams.average_round_points,
    teams.last_round_no,
    teams.last_round_points
  from teams
  order by
    standings_position,
    teams.round_wins desc,
    teams.best_round_points desc,
    teams.team_name;
$$;

revoke all on function get_fantasy_season_leaderboard(text) from public;
grant execute on function get_fantasy_season_leaderboard(text) to authenticated;


-- ============================================================
-- 2. ONE ROUND LEADERBOARD
-- ============================================================

drop function if exists get_fantasy_round_leaderboard(uuid);

create function get_fantasy_round_leaderboard(
  p_round_id uuid
)
returns table(
  standings_position bigint,
  team_id uuid,
  user_id uuid,
  team_name text,
  round_points numeric,
  base_points numeric,
  captain_bonus numeric,
  vice_captain_bonus numeric
)
language sql
stable
security definer
set search_path=public
as $$
  select
    dense_rank() over(order by trp.total_points desc) as standings_position,
    trp.team_id,
    trp.user_id,
    s.team_name,
    trp.total_points::numeric as round_points,
    trp.base_points::numeric,
    trp.captain_bonus::numeric,
    trp.vice_captain_bonus::numeric
  from fantasy_team_round_points trp
  join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  join fantasy_rounds r on r.id=trp.round_id
  where trp.round_id=p_round_id
    and r.round_no<9000
  order by
    standings_position,
    s.team_name;
$$;

revoke all on function get_fantasy_round_leaderboard(uuid) from public;
grant execute on function get_fantasy_round_leaderboard(uuid) to authenticated;


-- ============================================================
-- 3. TEAM SEASON HISTORY
-- Returns the stored, historical score for each calculated real round.
-- Any recalculation is therefore an explicit admin action in the scoring tool.
-- ============================================================

drop function if exists get_fantasy_team_season_history(uuid,text);

create function get_fantasy_team_season_history(
  p_team_id uuid,
  p_season text
)
returns table(
  round_id uuid,
  round_no integer,
  round_name text,
  deadline_at timestamptz,
  round_points numeric,
  base_points numeric,
  captain_bonus numeric,
  vice_captain_bonus numeric,
  round_position bigint,
  calculated_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  with ranked as (
    select
      trp.id,
      trp.team_id,
      trp.round_id,
      trp.total_points,
      trp.base_points,
      trp.captain_bonus,
      trp.vice_captain_bonus,
      trp.calculated_at,
      dense_rank() over(
        partition by trp.round_id
        order by trp.total_points desc
      ) as round_rank
    from fantasy_team_round_points trp
    join fantasy_rounds rx on rx.id=trp.round_id
    where trp.season=p_season
      and rx.season=p_season
      and rx.round_no<9000
  )
  select
    r.id as round_id,
    r.round_no,
    r.name as round_name,
    r.deadline_at,
    ranked.total_points::numeric as round_points,
    ranked.base_points::numeric,
    ranked.captain_bonus::numeric,
    ranked.vice_captain_bonus::numeric,
    ranked.round_rank as round_position,
    ranked.calculated_at
  from ranked
  join fantasy_rounds r on r.id=ranked.round_id
  where ranked.team_id=p_team_id
  order by r.round_no;
$$;

revoke all on function get_fantasy_team_season_history(uuid,text) from public;
grant execute on function get_fantasy_team_season_history(uuid,text) to authenticated;


-- ============================================================
-- 4. LEADERBOARD READINESS / ADMIN CONTROL
-- Helps verify that scoring coverage and leaderboard coverage agree.
-- ============================================================

drop function if exists get_fantasy_leaderboard_readiness(text);

create function get_fantasy_leaderboard_readiness(
  p_season text
)
returns table(
  fantasy_teams bigint,
  real_rounds bigint,
  rounds_with_scores bigint,
  stored_team_round_results bigint,
  latest_scored_round integer
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists(
    select 1 from players p
    where p.id=v_user and coalesce(p.admin,false)
  ) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    (select count(*)::bigint from fantasy_user_teams t where t.season=p_season),
    (select count(*)::bigint from fantasy_rounds r where r.season=p_season and r.round_no<9000),
    (
      select count(distinct trp.round_id)::bigint
      from fantasy_team_round_points trp
      join fantasy_rounds r on r.id=trp.round_id
      where trp.season=p_season and r.round_no<9000
    ),
    (
      select count(*)::bigint
      from fantasy_team_round_points trp
      join fantasy_rounds r on r.id=trp.round_id
      where trp.season=p_season and r.round_no<9000
    ),
    (
      select max(r.round_no)::integer
      from fantasy_team_round_points trp
      join fantasy_rounds r on r.id=trp.round_id
      where trp.season=p_season and r.round_no<9000
    );
end;
$$;

revoke all on function get_fantasy_leaderboard_readiness(text) from public;
grant execute on function get_fantasy_leaderboard_readiness(text) to authenticated;
