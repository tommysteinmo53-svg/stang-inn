-- MP-01 Scaling Readiness
-- Lightweight Fantasy home summary v1.
-- Returnerer bare den innloggede brukerens sesongpoeng/plassering.
-- Bevarer autoritativ MP-07 tie-break:
-- total_points -> round_wins -> best_round_points.
-- Deaktiverte brukere deltar ikke i aktiv ranking.
-- Endrer ingen 2026/27-data.

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
  with real_results as (
    select
      trp.team_id,
      trp.total_points,
      dense_rank() over (
        partition by trp.round_id
        order by trp.total_points desc
      ) as round_rank
    from public.fantasy_team_round_points trp
    join public.fantasy_rounds r
      on r.id = trp.round_id
    where trp.season = p_season
      and r.season = p_season
      and r.round_no < 9000
  ),

  aggregates as (
    select
      rr.team_id,
      sum(rr.total_points)::numeric as total_points,
      count(*) filter (
        where rr.round_rank = 1
      )::bigint as round_wins,
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
    left join aggregates a
      on a.team_id = t.id
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
    r.team_id,
    r.total_points,
    r.standings_position,
    r.participant_count
  from ranked r
  where r.user_id = auth.uid();
$$;

revoke all
on function public.get_my_fantasy_home_summary_v1(text)
from public, anon;

grant execute
on function public.get_my_fantasy_home_summary_v1(text)
to authenticated;

comment on function public.get_my_fantasy_home_summary_v1(text) is
  'MP-01 scaling: lightweight authenticated Fantasy homepage rank/points summary using authoritative season tie-break and excluding deactivated users.';
