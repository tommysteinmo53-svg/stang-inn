-- MP-07.10 — Fantasy team name + owner name in competition surfaces.
-- Historical policy:
--   * season leaderboard: current team name + current confirmed profile name
--   * round history/round leaderboard: snapshot-frozen team name + owner name
--   * monthly leaderboard: identity from the team's latest snapshot in that month
-- Ranking, scoring and tie-break expressions are unchanged.

alter table public.fantasy_team_round_snapshots
  add column if not exists owner_name text;

create or replace function public.capture_fantasy_snapshot_owner_name_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.owner_name is null then
    select nullif(btrim(p.display_name),'')
      into new.owner_name
    from public.players p
    where p.id=new.user_id
      and p.profile_name_confirmed_at is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists fantasy_snapshot_capture_owner_name_v1 on public.fantasy_team_round_snapshots;
create trigger fantasy_snapshot_capture_owner_name_v1
before insert on public.fantasy_team_round_snapshots
for each row execute function public.capture_fantasy_snapshot_owner_name_v1();

create or replace function public.get_fantasy_competition_table_v2(p_season text)
returns table(
  standings_position bigint, previous_standings_position bigint, position_change integer,
  participant_count integer, team_id uuid, user_id uuid, team_name text, owner_name text,
  total_points numeric, rounds_scored bigint, round_wins bigint, best_round_points numeric,
  average_round_points numeric, last_round_no integer, last_round_points numeric,
  last_round_position bigint, last_round_participants integer
)
language sql stable security definer set search_path=public
as $$
with scored_rounds as (
  select distinct r.id as round_id,r.round_no
  from public.fantasy_team_round_points trp
  join public.fantasy_rounds r on r.id=trp.round_id
  where trp.season=p_season and r.season=p_season and r.round_no<9000
), round_markers as (
  select max(sr.round_no)::integer as latest_round_no,
         (select max(sr2.round_no)::integer from scored_rounds sr2 where sr2.round_no<max(sr.round_no)) as previous_round_no
  from scored_rounds sr
), real_results as (
  select trp.team_id,trp.user_id,trp.round_id,r.round_no,trp.total_points,
         dense_rank() over(partition by trp.round_id order by trp.total_points desc) as round_rank,
         count(*) over(partition by trp.round_id)::integer as round_participants
  from public.fantasy_team_round_points trp
  join public.fantasy_rounds r on r.id=trp.round_id
  where trp.season=p_season and r.season=p_season and r.round_no<9000
), aggregates as (
  select rr.team_id,sum(rr.total_points)::numeric as total_points,count(*)::bigint as rounds_scored,
         count(*) filter(where rr.round_rank=1)::bigint as round_wins,
         max(rr.total_points)::numeric as best_round_points,
         round(avg(rr.total_points),2)::numeric as average_round_points
  from real_results rr group by rr.team_id
), latest_round as (
  select rr.team_id,rr.round_no,rr.total_points,rr.round_rank,rr.round_participants
  from real_results rr cross join round_markers rm where rr.round_no=rm.latest_round_no
), teams as (
  select t.id as team_id,t.user_id,t.name as team_name,
         coalesce(nullif(btrim(p.display_name),''),'Ukjent spiller')::text as owner_name,
         coalesce(a.total_points,0)::numeric as total_points,coalesce(a.rounds_scored,0)::bigint as rounds_scored,
         coalesce(a.round_wins,0)::bigint as round_wins,coalesce(a.best_round_points,0)::numeric as best_round_points,
         coalesce(a.average_round_points,0)::numeric as average_round_points,
         lr.round_no as last_round_no,lr.total_points::numeric as last_round_points,
         lr.round_rank as last_round_position,lr.round_participants as last_round_participants
  from public.fantasy_user_teams t
  left join public.players p on p.id=t.user_id and p.profile_name_confirmed_at is not null
  left join aggregates a on a.team_id=t.id left join latest_round lr on lr.team_id=t.id
  where t.season=p_season
), current_ranked as (
  select teams.*,
         dense_rank() over(order by teams.total_points desc,teams.round_wins desc,teams.best_round_points desc) as current_position,
         count(*) over()::integer as participant_count
  from teams
), previous_stats as (
  select t.id as team_id,
         coalesce(sum(rr.total_points) filter(where rr.round_no<=rm.previous_round_no),0)::numeric as previous_total,
         coalesce(count(*) filter(where rr.round_no<=rm.previous_round_no and rr.round_rank=1),0)::bigint as previous_round_wins,
         coalesce(max(rr.total_points) filter(where rr.round_no<=rm.previous_round_no),0)::numeric as previous_best_round
  from public.fantasy_user_teams t cross join round_markers rm
  left join real_results rr on rr.team_id=t.id where t.season=p_season
  group by t.id,rm.previous_round_no
), previous_ranked as (
  select ps.team_id,
         case when rm.previous_round_no is null then null::bigint
              else dense_rank() over(order by ps.previous_total desc,ps.previous_round_wins desc,ps.previous_best_round desc) end as previous_position
  from previous_stats ps cross join round_markers rm
)
select cr.current_position,pr.previous_position,
       case when pr.previous_position is null then 0 else (pr.previous_position-cr.current_position)::integer end,
       cr.participant_count,cr.team_id,cr.user_id,cr.team_name,cr.owner_name,cr.total_points,cr.rounds_scored,cr.round_wins,
       cr.best_round_points,cr.average_round_points,cr.last_round_no,cr.last_round_points,cr.last_round_position,cr.last_round_participants
from current_ranked cr left join previous_ranked pr on pr.team_id=cr.team_id
order by cr.current_position,cr.total_points desc,cr.round_wins desc,cr.best_round_points desc,cr.team_name;
$$;

create or replace function public.get_fantasy_round_leaderboard_v2(p_round_id uuid)
returns table(standings_position bigint,team_id uuid,user_id uuid,team_name text,owner_name text,
  round_points numeric,base_points numeric,captain_bonus numeric,vice_captain_bonus numeric)
language sql stable security definer set search_path=public
as $$
  select dense_rank() over(order by trp.total_points desc),trp.team_id,trp.user_id,s.team_name,
         coalesce(nullif(btrim(s.owner_name),''),'Ukjent spiller')::text,
         trp.total_points::numeric,trp.base_points::numeric,trp.captain_bonus::numeric,trp.vice_captain_bonus::numeric
  from public.fantasy_team_round_points trp
  join public.fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  join public.fantasy_rounds r on r.id=trp.round_id
  where trp.round_id=p_round_id and r.round_no<9000
  order by 1,s.team_name;
$$;

create or replace function public.get_fantasy_monthly_leaderboard_v2(p_season text)
returns table(month_key text,month_start date,standings_position bigint,team_id uuid,user_id uuid,
  team_name text,owner_name text,monthly_points numeric,rounds_scored bigint,round_wins bigint)
language sql stable security definer set search_path=public
as $$
with scored as (
  select trp.team_id,trp.user_id,trp.round_id,trp.snapshot_id,trp.total_points,r.round_no,r.deadline_at,
         date_trunc('month',r.deadline_at at time zone 'Europe/Oslo')::date as month_start,
         dense_rank() over(partition by trp.round_id order by trp.total_points desc) as round_rank
  from public.fantasy_team_round_points trp join public.fantasy_rounds r on r.id=trp.round_id
  where trp.season=p_season and r.season=p_season and r.round_no<9000
), monthly as (
  select s.month_start,s.team_id,s.user_id,sum(s.total_points)::numeric as monthly_points,
         count(*)::bigint as rounds_scored,count(*) filter(where s.round_rank=1)::bigint as round_wins
  from scored s group by s.month_start,s.team_id,s.user_id
), ranked as (
  select m.*,dense_rank() over(partition by m.month_start order by m.monthly_points desc) as standings_position from monthly m
), identity_at_month_end as (
  select distinct on (s.month_start,s.team_id) s.month_start,s.team_id,snap.team_name,
         coalesce(nullif(btrim(snap.owner_name),''),'Ukjent spiller')::text as owner_name
  from scored s join public.fantasy_team_round_snapshots snap on snap.id=s.snapshot_id
  order by s.month_start,s.team_id,s.round_no desc,snap.captured_at desc
)
select to_char(r.month_start,'YYYY-MM'),r.month_start,r.standings_position,r.team_id,r.user_id,
       i.team_name,i.owner_name,r.monthly_points,r.rounds_scored,r.round_wins
from ranked r join identity_at_month_end i on i.month_start=r.month_start and i.team_id=r.team_id
order by r.month_start desc,r.standings_position,i.team_name;
$$;

create or replace function public.get_fantasy_team_season_history_v3(p_team_id uuid,p_season text)
returns table(round_id uuid,round_no integer,deadline_at timestamptz,team_name text,owner_name text,
  round_points numeric,round_position integer,booster_type text,event_type text,event_budget numeric)
language sql stable security definer set search_path=public
as $$
with scored as (
  select trp.round_id,r.round_no,r.deadline_at,trp.team_id,trp.total_points,s.team_name,
         coalesce(nullif(btrim(s.owner_name),''),'Ukjent spiller')::text as owner_name,
         s.booster_type,s.event_type,s.event_budget,
         rank() over(partition by trp.round_id order by trp.total_points desc,trp.calculated_at asc,trp.team_id) as pos
  from public.fantasy_team_round_points trp join public.fantasy_rounds r on r.id=trp.round_id
  join public.fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  where trp.season=p_season and r.season=p_season and r.round_no<9000
)
select round_id,round_no,deadline_at,team_name,owner_name,total_points::numeric,pos::integer,booster_type,event_type,event_budget::numeric
from scored where team_id=p_team_id order by round_no desc;
$$;

revoke all on function public.get_fantasy_competition_table_v2(text) from public;
revoke all on function public.get_fantasy_round_leaderboard_v2(uuid) from public;
revoke all on function public.get_fantasy_monthly_leaderboard_v2(text) from public;
revoke all on function public.get_fantasy_team_season_history_v3(uuid,text) from public;
grant execute on function public.get_fantasy_competition_table_v2(text) to authenticated;
grant execute on function public.get_fantasy_round_leaderboard_v2(uuid) to authenticated;
grant execute on function public.get_fantasy_monthly_leaderboard_v2(text) to authenticated;
grant execute on function public.get_fantasy_team_season_history_v3(uuid,text) to authenticated;
