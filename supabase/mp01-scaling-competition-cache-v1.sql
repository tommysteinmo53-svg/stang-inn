-- MP-01 Scaling Readiness
-- Precompute expensive season aggregates once, then rank/filter the small cache
-- against live user/team identity at read time.
--
-- Security:
--   * cache tables have RLS enabled and no client grants/policies
--   * refresh RPCs are service_role-only
--   * read RPCs stay authenticated-only
--
-- Correctness:
--   * active/deactivated users are filtered live (no stale lifecycle state)
--   * current team/profile names are read live
--   * Fantasy tie-break remains total_points -> round_wins -> best_round_points
--   * historical latest-round placement remains the placement at scoring time
--   * no authoritative match/tip/Fantasy competition data is modified

create table if not exists public.tipping_leaderboard_cache (
  player_id uuid primary key references public.players(id) on delete cascade,
  points bigint not null default 0,
  exact bigint not null default 0,
  correct_outcome bigint not null default 0,
  scored_tips bigint not null default 0,
  hit_rate integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  refreshed_at timestamptz not null default now()
);

create index if not exists tipping_leaderboard_cache_points_idx
  on public.tipping_leaderboard_cache(points desc, exact desc, correct_outcome desc);

alter table public.tipping_leaderboard_cache enable row level security;
revoke all on table public.tipping_leaderboard_cache from public, anon, authenticated;

create table if not exists public.fantasy_season_leaderboard_cache (
  season text not null,
  team_id uuid not null references public.fantasy_user_teams(id) on delete cascade,
  user_id uuid not null references public.players(id) on delete cascade,
  total_points numeric not null default 0,
  rounds_scored bigint not null default 0,
  round_wins bigint not null default 0,
  best_round_points numeric not null default 0,
  average_round_points numeric not null default 0,
  previous_total numeric not null default 0,
  previous_round_wins bigint not null default 0,
  previous_best_round_points numeric not null default 0,
  previous_round_no integer,
  last_round_no integer,
  last_round_points numeric,
  last_round_position bigint,
  last_round_participants integer,
  refreshed_at timestamptz not null default now(),
  primary key (season, team_id)
);

create unique index if not exists fantasy_season_leaderboard_cache_user_season_idx
  on public.fantasy_season_leaderboard_cache(user_id, season);
create index if not exists fantasy_season_leaderboard_cache_rank_idx
  on public.fantasy_season_leaderboard_cache(
    season, total_points desc, round_wins desc, best_round_points desc
  );

alter table public.fantasy_season_leaderboard_cache enable row level security;
revoke all on table public.fantasy_season_leaderboard_cache from public, anon, authenticated;

create or replace function public.refresh_tipping_leaderboard_cache_v1()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  refreshed_rows integer;
begin
  delete from public.tipping_leaderboard_cache;

  insert into public.tipping_leaderboard_cache (
    player_id, points, exact, correct_outcome, scored_tips,
    hit_rate, streak, best_streak, refreshed_at
  )
  with finished_matches as (
    select
      m.id,
      m.home_score,
      m.away_score,
      row_number() over (order by m.match_time nulls last, m.id)::integer as match_no
    from public.matches m
    where m.finished = true
      and m.home_score is not null
      and m.away_score is not null
  ),
  max_match as (
    select coalesce(max(match_no), 0)::integer as max_match_no
    from finished_matches
  ),
  resolved_tips as (
    select
      t.player_id,
      fm.match_no,
      case
        when t.points is not null then t.points::bigint
        when t.home_tip = fm.home_score and t.away_tip = fm.away_score then 5::bigint
        when
          (case when t.home_tip > t.away_tip then 'H' when t.home_tip < t.away_tip then 'A' else 'D' end)
          =
          (case when fm.home_score > fm.away_score then 'H' when fm.home_score < fm.away_score then 'A' else 'D' end)
          then 3::bigint
        else 0::bigint
      end as resolved_points
    from public.tips t
    join finished_matches fm on fm.id = t.match_id
  ),
  aggregates as (
    select
      p.id as player_id,
      coalesce(sum(rt.resolved_points), 0)::bigint as points,
      count(*) filter (where rt.resolved_points = 5)::bigint as exact,
      count(*) filter (where rt.resolved_points = 3)::bigint as correct_outcome,
      count(rt.match_no)::bigint as scored_tips,
      case
        when count(rt.match_no) = 0 then 0
        else round(
          100.0 * count(*) filter (where rt.resolved_points > 0)
          / count(rt.match_no)
        )::integer
      end as hit_rate
    from public.players p
    left join resolved_tips rt on rt.player_id = p.id
    group by p.id
  ),
  positive as (
    select
      rt.player_id,
      rt.match_no,
      rt.match_no - row_number() over (
        partition by rt.player_id
        order by rt.match_no
      )::integer as grp
    from resolved_tips rt
    where rt.resolved_points > 0
  ),
  runs as (
    select
      player_id,
      grp,
      count(*)::integer as run_len,
      max(match_no)::integer as run_end
    from positive
    group by player_id, grp
  ),
  streaks as (
    select
      r.player_id,
      coalesce(max(r.run_len), 0)::integer as best_streak,
      coalesce(
        max(r.run_len) filter (
          where r.run_end = (select max_match_no from max_match)
        ),
        0
      )::integer as streak
    from runs r
    group by r.player_id
  )
  select
    a.player_id,
    a.points,
    a.exact,
    a.correct_outcome,
    a.scored_tips,
    a.hit_rate,
    coalesce(s.streak, 0)::integer,
    coalesce(s.best_streak, 0)::integer,
    now()
  from aggregates a
  left join streaks s on s.player_id = a.player_id;

  get diagnostics refreshed_rows = row_count;
  return refreshed_rows;
end;
$$;

revoke all on function public.refresh_tipping_leaderboard_cache_v1() from public, anon, authenticated;
grant execute on function public.refresh_tipping_leaderboard_cache_v1() to service_role;

create or replace function public.refresh_fantasy_season_leaderboard_cache_v1(
  p_season text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  refreshed_rows integer;
begin
  delete from public.fantasy_season_leaderboard_cache
  where season = p_season;

  insert into public.fantasy_season_leaderboard_cache (
    season, team_id, user_id,
    total_points, rounds_scored, round_wins, best_round_points, average_round_points,
    previous_total, previous_round_wins, previous_best_round_points, previous_round_no,
    last_round_no, last_round_points, last_round_position, last_round_participants,
    refreshed_at
  )
  with scored_rounds as (
    select distinct r.id as round_id, r.round_no
    from public.fantasy_team_round_points trp
    join public.fantasy_rounds r on r.id = trp.round_id
    where trp.season = p_season
      and r.season = p_season
      and r.round_no < 9000
  ),
  round_markers as (
    select
      max(sr.round_no)::integer as latest_round_no,
      (
        select max(sr2.round_no)::integer
        from scored_rounds sr2
        where sr2.round_no < max(sr.round_no)
      ) as previous_round_no
    from scored_rounds sr
  ),
  real_results as (
    select
      trp.team_id,
      trp.round_id,
      r.round_no,
      trp.total_points,
      dense_rank() over (
        partition by trp.round_id
        order by trp.total_points desc
      )::bigint as round_rank,
      count(*) over (partition by trp.round_id)::integer as round_participants
    from public.fantasy_team_round_points trp
    join public.fantasy_rounds r on r.id = trp.round_id
    where trp.season = p_season
      and r.season = p_season
      and r.round_no < 9000
  ),
  aggregates as (
    select
      rr.team_id,
      sum(rr.total_points)::numeric as total_points,
      count(*)::bigint as rounds_scored,
      count(*) filter (where rr.round_rank = 1)::bigint as round_wins,
      max(rr.total_points)::numeric as best_round_points,
      round(avg(rr.total_points), 2)::numeric as average_round_points
    from real_results rr
    group by rr.team_id
  ),
  previous_stats as (
    select
      t.id as team_id,
      coalesce(sum(rr.total_points) filter (
        where rr.round_no <= rm.previous_round_no
      ), 0)::numeric as previous_total,
      coalesce(count(*) filter (
        where rr.round_no <= rm.previous_round_no
          and rr.round_rank = 1
      ), 0)::bigint as previous_round_wins,
      coalesce(max(rr.total_points) filter (
        where rr.round_no <= rm.previous_round_no
      ), 0)::numeric as previous_best_round_points,
      rm.previous_round_no
    from public.fantasy_user_teams t
    cross join round_markers rm
    left join real_results rr on rr.team_id = t.id
    where t.season = p_season
    group by t.id, rm.previous_round_no
  ),
  latest_round as (
    select
      rr.team_id,
      rr.round_no,
      rr.total_points,
      rr.round_rank,
      rr.round_participants
    from real_results rr
    cross join round_markers rm
    where rr.round_no = rm.latest_round_no
  )
  select
    p_season,
    t.id,
    t.user_id,
    coalesce(a.total_points, 0)::numeric,
    coalesce(a.rounds_scored, 0)::bigint,
    coalesce(a.round_wins, 0)::bigint,
    coalesce(a.best_round_points, 0)::numeric,
    coalesce(a.average_round_points, 0)::numeric,
    coalesce(ps.previous_total, 0)::numeric,
    coalesce(ps.previous_round_wins, 0)::bigint,
    coalesce(ps.previous_best_round_points, 0)::numeric,
    ps.previous_round_no,
    lr.round_no,
    lr.total_points::numeric,
    lr.round_rank::bigint,
    lr.round_participants::integer,
    now()
  from public.fantasy_user_teams t
  left join aggregates a on a.team_id = t.id
  left join previous_stats ps on ps.team_id = t.id
  left join latest_round lr on lr.team_id = t.id
  where t.season = p_season;

  get diagnostics refreshed_rows = row_count;
  return refreshed_rows;
end;
$$;

revoke all on function public.refresh_fantasy_season_leaderboard_cache_v1(text) from public, anon, authenticated;
grant execute on function public.refresh_fantasy_season_leaderboard_cache_v1(text) to service_role;

create or replace function public.get_tipping_leaderboard_v1()
returns table (
  player_id uuid,
  display_name text,
  points bigint,
  exact bigint,
  correct_outcome bigint,
  scored_tips bigint,
  hit_rate integer,
  streak integer,
  best_streak integer,
  standings_position bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active as (
    select
      c.player_id,
      p.display_name,
      c.points,
      c.exact,
      c.correct_outcome,
      c.scored_tips,
      c.hit_rate,
      c.streak,
      c.best_streak
    from public.tipping_leaderboard_cache c
    join public.players p
      on p.id = c.player_id
     and p.deactivated_at is null
  ),
  ranked as (
    select
      a.*,
      row_number() over (
        order by
          a.points desc,
          a.exact desc,
          a.correct_outcome desc,
          a.display_name asc,
          a.player_id asc
      )::bigint as standings_position
    from active a
  )
  select
    r.player_id,
    r.display_name,
    r.points,
    r.exact,
    r.correct_outcome,
    r.scored_tips,
    r.hit_rate,
    r.streak,
    r.best_streak,
    r.standings_position
  from ranked r
  order by r.standings_position;
$$;

revoke all on function public.get_tipping_leaderboard_v1() from public, anon;
grant execute on function public.get_tipping_leaderboard_v1() to authenticated;

create or replace function public.get_my_tipping_home_summary_v1()
returns table (
  points bigint,
  standings_position bigint,
  active_players bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active as (
    select
      c.player_id,
      p.display_name,
      c.points,
      c.exact,
      c.correct_outcome
    from public.tipping_leaderboard_cache c
    join public.players p
      on p.id = c.player_id
     and p.deactivated_at is null
  ),
  ranked as (
    select
      a.*,
      row_number() over (
        order by
          a.points desc,
          a.exact desc,
          a.correct_outcome desc,
          a.display_name asc,
          a.player_id asc
      )::bigint as standings_position,
      count(*) over ()::bigint as active_players
    from active a
  )
  select r.points, r.standings_position, r.active_players
  from ranked r
  where r.player_id = auth.uid();
$$;

revoke all on function public.get_my_tipping_home_summary_v1() from public, anon;
grant execute on function public.get_my_tipping_home_summary_v1() to authenticated;

create or replace function public.get_fantasy_competition_table_v2(p_season text)
returns table(
  standings_position bigint,
  previous_standings_position bigint,
  position_change integer,
  participant_count integer,
  team_id uuid,
  user_id uuid,
  team_name text,
  owner_name text,
  total_points numeric,
  rounds_scored bigint,
  round_wins bigint,
  best_round_points numeric,
  average_round_points numeric,
  last_round_no integer,
  last_round_points numeric,
  last_round_position bigint,
  last_round_participants integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active as (
    select
      c.*,
      t.name::text as team_name,
      coalesce(
        case
          when p.profile_name_confirmed_at is not null
            then nullif(btrim(p.display_name), '')
          else null
        end,
        'Ukjent spiller'
      )::text as owner_name
    from public.fantasy_season_leaderboard_cache c
    join public.fantasy_user_teams t
      on t.id = c.team_id
     and t.season = c.season
    join public.players p
      on p.id = c.user_id
     and p.deactivated_at is null
    where c.season = p_season
  ),
  current_ranked as (
    select
      a.*,
      dense_rank() over (
        order by
          a.total_points desc,
          a.round_wins desc,
          a.best_round_points desc
      )::bigint as current_position,
      count(*) over ()::integer as participant_count
    from active a
  ),
  previous_ranked as (
    select
      a.team_id,
      case
        when a.previous_round_no is null then null::bigint
        else dense_rank() over (
          order by
            a.previous_total desc,
            a.previous_round_wins desc,
            a.previous_best_round_points desc
        )::bigint
      end as previous_position
    from active a
  )
  select
    cr.current_position as standings_position,
    pr.previous_position as previous_standings_position,
    case
      when pr.previous_position is null then 0
      else (pr.previous_position - cr.current_position)::integer
    end as position_change,
    cr.participant_count,
    cr.team_id,
    cr.user_id,
    cr.team_name,
    cr.owner_name,
    cr.total_points,
    cr.rounds_scored,
    cr.round_wins,
    cr.best_round_points,
    cr.average_round_points,
    cr.last_round_no,
    cr.last_round_points,
    cr.last_round_position,
    cr.last_round_participants
  from current_ranked cr
  join previous_ranked pr on pr.team_id = cr.team_id
  order by
    cr.current_position,
    cr.total_points desc,
    cr.round_wins desc,
    cr.best_round_points desc,
    cr.team_name;
$$;

revoke all on function public.get_fantasy_competition_table_v2(text) from public, anon;
grant execute on function public.get_fantasy_competition_table_v2(text) to authenticated;

create or replace function public.get_my_fantasy_home_summary_v1(
  p_season text
)
returns table (
  team_id uuid,
  total_points numeric,
  standings_position bigint,
  participant_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active as (
    select c.*
    from public.fantasy_season_leaderboard_cache c
    join public.players p
      on p.id = c.user_id
     and p.deactivated_at is null
    where c.season = p_season
  ),
  ranked as (
    select
      a.*,
      dense_rank() over (
        order by
          a.total_points desc,
          a.round_wins desc,
          a.best_round_points desc
      )::bigint as standings_position,
      count(*) over ()::integer as participant_count
    from active a
  )
  select
    r.team_id,
    r.total_points,
    r.standings_position,
    r.participant_count
  from ranked r
  where r.user_id = auth.uid();
$$;

revoke all on function public.get_my_fantasy_home_summary_v1(text) from public, anon;
grant execute on function public.get_my_fantasy_home_summary_v1(text) to authenticated;

comment on table public.tipping_leaderboard_cache is
  'MP-01 scaling cache of expensive Tipping scoring metrics. Identity and active status are applied live by authenticated read RPCs.';
comment on table public.fantasy_season_leaderboard_cache is
  'MP-01 scaling cache of expensive Fantasy season metrics. Current identity, active status and ranking are applied live by authenticated read RPCs.';
comment on function public.refresh_tipping_leaderboard_cache_v1() is
  'Service-role-only refresh of Tipping scoring metrics used by cached read paths.';
comment on function public.refresh_fantasy_season_leaderboard_cache_v1(text) is
  'Service-role-only refresh of Fantasy season metrics, previous-round movement inputs and latest-round placement.';
comment on function public.get_fantasy_competition_table_v2(text) is
  'MP-01/MP-07 cached season leaderboard. Preserves authoritative tie-break and current identity while excluding deactivated users live.';

-- Seed only the new cache tables. Authoritative competition data is read-only here.
select public.refresh_tipping_leaderboard_cache_v1();
select public.refresh_fantasy_season_leaderboard_cache_v1('2026/27');

notify pgrst, 'reload schema';
