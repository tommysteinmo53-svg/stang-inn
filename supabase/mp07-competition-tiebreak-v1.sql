create or replace function public.get_fantasy_competition_table_v1(p_season text)
returns table(
  standings_position bigint,
  previous_standings_position bigint,
  position_change integer,
  participant_count integer,
  team_id uuid,
  user_id uuid,
  team_name text,
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
set search_path=public
as $$
with scored_rounds as (
  select distinct r.id as round_id,r.round_no
  from fantasy_team_round_points trp
  join fantasy_rounds r on r.id=trp.round_id
  where trp.season=p_season and r.season=p_season and r.round_no<9000
),
round_markers as (
  select max(sr.round_no)::integer as latest_round_no,
         (select max(sr2.round_no)::integer from scored_rounds sr2 where sr2.round_no<max(sr.round_no)) as previous_round_no
  from scored_rounds sr
),
real_results as (
  select trp.team_id,trp.user_id,trp.round_id,r.round_no,trp.total_points,
         dense_rank() over(partition by trp.round_id order by trp.total_points desc) as round_rank,
         count(*) over(partition by trp.round_id)::integer as round_participants
  from fantasy_team_round_points trp
  join fantasy_rounds r on r.id=trp.round_id
  where trp.season=p_season and r.season=p_season and r.round_no<9000
),
aggregates as (
  select rr.team_id,
         sum(rr.total_points)::numeric as total_points,
         count(*)::bigint as rounds_scored,
         count(*) filter(where rr.round_rank=1)::bigint as round_wins,
         max(rr.total_points)::numeric as best_round_points,
         round(avg(rr.total_points),2)::numeric as average_round_points
  from real_results rr
  group by rr.team_id
),
latest_round as (
  select rr.team_id,rr.round_no,rr.total_points,rr.round_rank,rr.round_participants
  from real_results rr cross join round_markers rm
  where rr.round_no=rm.latest_round_no
),
teams as (
  select t.id as team_id,t.user_id,t.name as team_name,
         coalesce(a.total_points,0)::numeric as total_points,
         coalesce(a.rounds_scored,0)::bigint as rounds_scored,
         coalesce(a.round_wins,0)::bigint as round_wins,
         coalesce(a.best_round_points,0)::numeric as best_round_points,
         coalesce(a.average_round_points,0)::numeric as average_round_points,
         lr.round_no as last_round_no,lr.total_points::numeric as last_round_points,
         lr.round_rank as last_round_position,lr.round_participants as last_round_participants
  from fantasy_user_teams t
  left join aggregates a on a.team_id=t.id
  left join latest_round lr on lr.team_id=t.id
  where t.season=p_season
),
current_ranked as (
  select teams.*,
         dense_rank() over(order by teams.total_points desc,teams.round_wins desc,teams.best_round_points desc) as current_position,
         count(*) over()::integer as participant_count
  from teams
),
previous_stats as (
  select t.id as team_id,
         coalesce(sum(rr.total_points) filter(where rr.round_no<=rm.previous_round_no),0)::numeric as previous_total,
         coalesce(count(*) filter(where rr.round_no<=rm.previous_round_no and rr.round_rank=1),0)::bigint as previous_round_wins,
         coalesce(max(rr.total_points) filter(where rr.round_no<=rm.previous_round_no),0)::numeric as previous_best_round
  from fantasy_user_teams t
  cross join round_markers rm
  left join real_results rr on rr.team_id=t.id
  where t.season=p_season
  group by t.id,rm.previous_round_no
),
previous_ranked as (
  select ps.team_id,
         case when rm.previous_round_no is null then null::bigint
              else dense_rank() over(order by ps.previous_total desc,ps.previous_round_wins desc,ps.previous_best_round desc)
         end as previous_position
  from previous_stats ps cross join round_markers rm
)
select cr.current_position as standings_position,
       pr.previous_position as previous_standings_position,
       case when pr.previous_position is null then 0 else (pr.previous_position-cr.current_position)::integer end as position_change,
       cr.participant_count,cr.team_id,cr.user_id,cr.team_name,cr.total_points,cr.rounds_scored,cr.round_wins,
       cr.best_round_points,cr.average_round_points,cr.last_round_no,cr.last_round_points,cr.last_round_position,cr.last_round_participants
from current_ranked cr
left join previous_ranked pr on pr.team_id=cr.team_id
order by cr.current_position,cr.total_points desc,cr.round_wins desc,cr.best_round_points desc,cr.team_name;
$$;

comment on function public.get_fantasy_competition_table_v1(text) is
'MP-07.5: season standings tie-breaks are total points, then round wins, then best single-round score. Fully equal teams share position; team name is display ordering only.';
