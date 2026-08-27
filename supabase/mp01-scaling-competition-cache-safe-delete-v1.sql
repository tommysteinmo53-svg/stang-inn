-- MP-01 production hotfix
-- Supabase Data API safe-update mode rejects DELETE without a WHERE clause.
-- Keep the refresh semantics identical while making the cache clear explicit.

create or replace function public.refresh_tipping_leaderboard_cache_v1()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  refreshed_rows integer;
begin
  delete from public.tipping_leaderboard_cache
  where true;

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
      (rt.match_no - row_number() over (
        partition by rt.player_id
        order by rt.match_no
      ))::integer as grp
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

revoke all on function public.refresh_tipping_leaderboard_cache_v1()
from public, anon, authenticated;

grant execute on function public.refresh_tipping_leaderboard_cache_v1()
to service_role;

notify pgrst, 'reload schema';
