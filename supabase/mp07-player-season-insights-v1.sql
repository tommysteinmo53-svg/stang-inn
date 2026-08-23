create or replace function public.get_my_fantasy_player_season_insights_v1(p_season text)
returns table(
  player_id uuid,
  player_name text,
  player_team text,
  player_position text,
  rounds_owned integer,
  longest_owned_streak integer,
  captain_rounds integer,
  vice_captain_rounds integer,
  total_points numeric,
  captain_role_points numeric
)
language sql
stable
security definer
set search_path=public
as $$
with mine as (
  select
    s.round_id,
    r.round_no,
    sp.player_id,
    sp.player_name,
    sp.team,
    sp.position,
    sp.is_captain,
    sp.is_vice_captain,
    coalesce(prp.total_points,0)::numeric as total_points,
    case when sp.is_captain or sp.is_vice_captain then coalesce(prp.total_points,0)::numeric else 0::numeric end as captain_role_points
  from fantasy_team_round_snapshots s
  join fantasy_rounds r on r.id=s.round_id
  join fantasy_team_round_snapshot_players sp on sp.snapshot_id=s.id
  left join fantasy_team_round_points trp on trp.snapshot_id=s.id
  left join fantasy_team_round_player_points prp on prp.team_round_points_id=trp.id and prp.player_id=sp.player_id
  where s.user_id=auth.uid()
    and s.season=p_season
    and r.season=p_season
    and r.round_no<9000
), streak_groups as (
  select m.*, round_no-row_number() over(partition by player_id order by round_no)::integer as grp
  from mine m
), streaks as (
  select player_id, max(cnt)::integer as longest_owned_streak
  from (
    select player_id,grp,count(*)::integer as cnt
    from streak_groups
    group by player_id,grp
  ) x
  group by player_id
)
select
  m.player_id,
  max(m.player_name) as player_name,
  max(m.team) as player_team,
  max(m.position) as player_position,
  count(distinct m.round_id)::integer as rounds_owned,
  coalesce(st.longest_owned_streak,0)::integer,
  count(*) filter(where m.is_captain)::integer as captain_rounds,
  count(*) filter(where m.is_vice_captain)::integer as vice_captain_rounds,
  sum(m.total_points)::numeric as total_points,
  sum(m.captain_role_points)::numeric as captain_role_points
from mine m
left join streaks st on st.player_id=m.player_id
group by m.player_id,st.longest_owned_streak
order by rounds_owned desc,total_points desc,player_name;
$$;

revoke all on function public.get_my_fantasy_player_season_insights_v1(text) from public;
grant execute on function public.get_my_fantasy_player_season_insights_v1(text) to authenticated;

comment on function public.get_my_fantasy_player_season_insights_v1(text) is
'MP-07.9: authenticated snapshot-first player ownership, retention and captain-role season insights. No current-team reconstruction.';
