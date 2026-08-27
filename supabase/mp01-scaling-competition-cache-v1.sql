-- MP-01 Scaling Readiness
-- Precomputed competition standings for high-concurrency read paths.
-- Read RPCs stay authenticated-only; cache tables are never directly exposed.
-- Refresh RPCs are service-role only and are intended to run after authoritative
-- EHL/Fantasy scoring or explicit admin identity lifecycle changes.

create table if not exists public.tipping_leaderboard_cache (
  player_id uuid primary key references public.players(id) on delete cascade,
  display_name text not null,
  points bigint not null default 0,
  exact bigint not null default 0,
  correct_outcome bigint not null default 0,
  scored_tips bigint not null default 0,
  hit_rate integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  standings_position bigint not null,
  refreshed_at timestamptz not null default now()
);

create index if not exists tipping_leaderboard_cache_position_idx
  on public.tipping_leaderboard_cache(standings_position);

alter table public.tipping_leaderboard_cache enable row level security;
revoke all on public.tipping_leaderboard_cache from public, anon, authenticated;

create table if not exists public.fantasy_season_leaderboard_cache (
  season text not null,
  team_id uuid not null references public.fantasy_user_teams(id) on delete cascade,
  user_id uuid not null references public.players(id) on delete cascade,
  total_points numeric not null default 0,
  round_wins bigint not null default 0,
  best_round_points numeric not null default 0,
  standings_position bigint not null,
  participant_count integer not null,
  refreshed_at timestamptz not null default now(),
  primary key (season, team_id)
);

create unique index if not exists fantasy_season_leaderboard_cache_user_season_idx
  on public.fantasy_season_leaderboard_cache(user_id, season);
create index if not exists fantasy_season_leaderboard_cache_position_idx
  on public.fantasy_season_leaderboard_cache(season, standings_position);

alter table public.fantasy_season_leaderboard_cache enable row level security;
revoke all on public.fantasy_season_leaderboard_cache from public, anon, authenticated;

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
    player_id, display_name, points, exact, correct_outcome, scored_tips,
    hit_rate, streak, best_streak, standings_position, refreshed_at
  )
  with finished_matches as (
    select
      m.id,
      m.match_time,
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
      p.display_name,
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
    where p.deactivated_at is null
    group by p.id, p.display_name
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
  ),
  ranked as (
    select
      a.*,
      coalesce(s.streak, 0)::integer as streak,
      coalesce(s.best_streak, 0)::integer as best_streak,
      row_number() over (
        order by
          a.points desc,
          a.exact desc,
          a.correct_outcome desc,
          a.display_name asc,
          a.player_id asc
      )::bigint as standings_position
    from aggregates a
    left join streaks s on s.player_id = a.player_id
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
    r.standings_position,
    now()
  from ranked r;

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
    season, team_id, user_id, total_points, round_wins, best_round_points,
    standings_position, participant_count, refreshed_at
  )
  with real_results as (
    select
      trp.team_id,
      trp.total_points,
      dense_rank() over (
        partition by trp.round_id
        order by trp.total_points desc
      ) as round_rank
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
      count(*) filter (where rr.round_rank = 1)::bigint as round_wins,
      max(rr.total_points)::numeric as best_round_points
    from real_results rr
    group by rr.team_id
  ),
  active_teams as (
    select
      t.id as team_id,
      t.user_id,
      coalesce(a.total_points, 0)::numeric as total_points,
      coalesce(a.round_wins, 0)::bigint as round_wins,
      coalesce(a.best_round_points, 0)::numeric as best_round_points
    from public.fantasy_user_teams t
    join public.players p
      on p.id = t.user_id
     and p.deactivated_at is null
    left join aggregates a on a.team_id = t.id
    where t.season = p_season
  ),
  ranked as (
    select
      at.*,
      dense_rank() over (
        order by
          at.total_points desc,
          at.round_wins desc,
          at.best_round_points desc
      )::bigint as standings_position,
      count(*) over ()::integer as participant_count
    from active_teams at
  )
  select
    p_season,
    r.team_id,
    r.user_id,
    r.total_points,
    r.round_wins,
    r.best_round_points,
    r.standings_position,
    r.participant_count,
    now()
  from ranked r;

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
  select
    c.player_id,
    c.display_name,
    c.points,
    c.exact,
    c.correct_outcome,
    c.scored_tips,
    c.hit_rate,
    c.streak,
    c.best_streak,
    c.standings_position
  from public.tipping_leaderboard_cache c
  order by c.standings_position;
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
  select
    c.points,
    c.standings_position,
    (select count(*)::bigint from public.tipping_leaderboard_cache)
  from public.tipping_leaderboard_cache c
  where c.player_id = auth.uid();
$$;

revoke all on function public.get_my_tipping_home_summary_v1() from public, anon;
grant execute on function public.get_my_tipping_home_summary_v1() to authenticated;

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
  select
    c.team_id,
    c.total_points,
    c.standings_position,
    c.participant_count
  from public.fantasy_season_leaderboard_cache c
  where c.user_id = auth.uid()
    and c.season = p_season;
$$;

revoke all on function public.get_my_fantasy_home_summary_v1(text) from public, anon;
grant execute on function public.get_my_fantasy_home_summary_v1(text) to authenticated;

comment on table public.tipping_leaderboard_cache is
  'MP-01 scaling cache refreshed from authoritative scored tips; direct client access is denied.';
comment on table public.fantasy_season_leaderboard_cache is
  'MP-01 scaling cache refreshed from authoritative Fantasy round points; direct client access is denied.';
comment on function public.refresh_tipping_leaderboard_cache_v1() is
  'Service-role-only refresh of cached Tipping standings.';
comment on function public.refresh_fantasy_season_leaderboard_cache_v1(text) is
  'Service-role-only refresh of cached Fantasy season standings.';

-- Seed caches immediately when the migration is installed. These calls are read/aggregate
-- operations over authoritative data plus writes only to the new cache tables.
select public.refresh_tipping_leaderboard_cache_v1();
select public.refresh_fantasy_season_leaderboard_cache_v1('2026/27');

notify pgrst, 'reload schema';
