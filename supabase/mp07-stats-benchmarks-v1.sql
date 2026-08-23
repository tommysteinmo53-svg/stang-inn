create or replace function public.get_my_fantasy_stats_benchmarks_v1(p_season text)
returns table(
  round_id uuid,
  round_no integer,
  my_points numeric,
  field_average numeric,
  top10_cutoff numeric,
  top1_cutoff numeric,
  participant_count integer
)
language sql
stable
security definer
set search_path=public
as $$
with scored as (
  select
    trp.round_id,
    r.round_no,
    trp.user_id,
    trp.total_points::numeric as points,
    count(*) over(partition by trp.round_id)::integer as participant_count,
    avg(trp.total_points) over(partition by trp.round_id)::numeric as field_average,
    percent_rank() over(partition by trp.round_id order by trp.total_points desc) as pct_rank
  from fantasy_team_round_points trp
  join fantasy_rounds r on r.id=trp.round_id
  where trp.season=p_season
    and r.season=p_season
    and r.round_no<9000
), cutoffs as (
  select
    round_id,
    max(round_no)::integer as round_no,
    max(participant_count)::integer as participant_count,
    max(field_average)::numeric as field_average,
    min(points) filter(where pct_rank<=0.10)::numeric as top10_cutoff,
    min(points) filter(where pct_rank<=0.01)::numeric as top1_cutoff
  from scored
  group by round_id
)
select
  s.round_id,
  s.round_no,
  s.points::numeric as my_points,
  c.field_average,
  c.top10_cutoff,
  c.top1_cutoff,
  c.participant_count
from scored s
join cutoffs c on c.round_id=s.round_id
where s.user_id=auth.uid()
order by s.round_no;
$$;

revoke all on function public.get_my_fantasy_stats_benchmarks_v1(text) from public;
grant execute on function public.get_my_fantasy_stats_benchmarks_v1(text) to authenticated;

comment on function public.get_my_fantasy_stats_benchmarks_v1(text) is
'MP-07.9 authenticated round benchmark comparison against actual field average, top 10 percent and top 1 percent cutoffs.';
