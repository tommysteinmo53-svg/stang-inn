-- MP-01 scaling readiness: keep homepage Tipping rank in Postgres instead of
-- downloading every player's tips/profile to each client.

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
  with scored_tips as (
    select
      t.player_id,
      case
        when t.points is not null then t.points::bigint
        when m.home_score is null or m.away_score is null then 0::bigint
        when t.home_tip = m.home_score and t.away_tip = m.away_score then 5::bigint
        when
          case when t.home_tip > t.away_tip then 'H' when t.home_tip < t.away_tip then 'A' else 'D' end
          =
          case when m.home_score > m.away_score then 'H' when m.home_score < m.away_score then 'A' else 'D' end
          then 3::bigint
        else 0::bigint
      end as resolved_points
    from public.tips t
    join public.matches m on m.id = t.match_id
    where m.finished = true
      and m.home_score is not null
      and m.away_score is not null
  ), totals as (
    select
      p.id as player_id,
      p.display_name,
      coalesce(sum(st.resolved_points), 0)::bigint as total_points,
      count(*) filter (where st.resolved_points = 5)::bigint as exact_count,
      count(*) filter (where st.resolved_points = 3)::bigint as correct_count
    from public.players p
    left join scored_tips st on st.player_id = p.id
    where p.deactivated_at is null
    group by p.id, p.display_name
  ), ranked as (
    select
      player_id,
      total_points,
      row_number() over (
        order by total_points desc, exact_count desc, correct_count desc, display_name asc, player_id asc
      )::bigint as standings_position
    from totals
  )
  select
    r.total_points as points,
    r.standings_position,
    (select count(*)::bigint from totals) as active_players
  from ranked r
  where r.player_id = auth.uid();
$$;

revoke all on function public.get_my_tipping_home_summary_v1() from public, anon;
grant execute on function public.get_my_tipping_home_summary_v1() to authenticated;

comment on function public.get_my_tipping_home_summary_v1() is
  'Returns only the authenticated active user tipping points/rank for lightweight homepage rendering; deactivated users are excluded.';
