-- MP-01 Scaling Readiness
-- Server-side Tipping leaderboard v1.
-- Replaces client-side global tips/matches aggregation.
-- Does not modify 2026/27 competition data.

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
  with active_players as (
    select p.id, p.display_name
    from public.players p
    where p.deactivated_at is null
  ),
  finished_matches as (
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
  resolved as (
    select
      ap.id as player_id,
      ap.display_name,
      fm.id as match_id,
      fm.match_no,
      case
        when t.id is null then null
        when t.points is not null then t.points::bigint
        when t.home_tip = fm.home_score and t.away_tip = fm.away_score then 5::bigint
        when
          (case when t.home_tip > t.away_tip then 'H' when t.home_tip < t.away_tip then 'A' else 'D' end)
          =
          (case when fm.home_score > fm.away_score then 'H' when fm.home_score < fm.away_score then 'A' else 'D' end)
          then 3::bigint
        else 0::bigint
      end as resolved_points
    from active_players ap
    cross join finished_matches fm
    left join public.tips t
      on t.player_id = ap.id
     and t.match_id = fm.id
  ),
  streak_groups as (
    select
      r.*,
      sum(case when coalesce(r.resolved_points, 0) <= 0 then 1 else 0 end) over (
        partition by r.player_id
        order by r.match_no
        rows between unbounded preceding and current row
      ) as streak_group
    from resolved r
  ),
  streak_lengths as (
    select
      sg.player_id,
      sg.match_no,
      sg.resolved_points,
      case
        when coalesce(sg.resolved_points, 0) > 0 then
          count(*) over (
            partition by sg.player_id, sg.streak_group
            order by sg.match_no
            rows between unbounded preceding and current row
          )::integer
        else 0
      end as running_streak
    from streak_groups sg
  ),
  aggregates as (
    select
      ap.id as player_id,
      ap.display_name,
      coalesce(sum(r.resolved_points) filter (where r.resolved_points is not null), 0)::bigint as points,
      count(*) filter (where r.resolved_points = 5)::bigint as exact,
      count(*) filter (where r.resolved_points = 3)::bigint as correct_outcome,
      count(*) filter (where r.resolved_points is not null)::bigint as scored_tips,
      case
        when count(*) filter (where r.resolved_points is not null) = 0 then 0
        else round(
          100.0 * count(*) filter (where coalesce(r.resolved_points, 0) > 0)
          / count(*) filter (where r.resolved_points is not null)
        )::integer
      end as hit_rate,
      coalesce((
        select sl.running_streak
        from streak_lengths sl
        where sl.player_id = ap.id
        order by sl.match_no desc
        limit 1
      ), 0)::integer as streak,
      coalesce((
        select max(sl.running_streak)
        from streak_lengths sl
        where sl.player_id = ap.id
      ), 0)::integer as best_streak
    from active_players ap
    left join resolved r on r.player_id = ap.id
    group by ap.id, ap.display_name
  ),
  ranked as (
    select
      a.*,
      row_number() over (
        order by a.points desc, a.exact desc, a.correct_outcome desc, a.display_name asc, a.player_id asc
      )::bigint as standings_position
    from aggregates a
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

comment on function public.get_tipping_leaderboard_v1() is
  'MP-01 scaling: authenticated server-side Tipping leaderboard. Excludes deactivated users and avoids downloading global tip history to every client.';
