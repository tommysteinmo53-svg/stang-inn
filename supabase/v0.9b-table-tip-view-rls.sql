-- Stang Inn v0.9b – sikre tabelltips-viewer med innlogget brukers RLS
-- Kjør etter v0.9-ehl-standings.sql.

create or replace view public.table_tip_deviation
with (security_invoker = true)
as
select
  tt.player_id,
  tt.team,
  tt.position as predicted_position,
  es.position as actual_position,
  abs(tt.position - es.position) as deviation
from public.table_tips tt
join public.ehl_standings es
  on es.team = tt.team
 and es.season = '2026/27';

grant select on public.table_tip_deviation to authenticated;

create or replace view public.table_tip_scores
with (security_invoker = true)
as
select
  p.id as player_id,
  p.display_name,
  count(d.team)::integer as compared_teams,
  coalesce(sum(d.deviation), 0)::integer as total_deviation,
  coalesce(max(d.deviation), 0)::integer as worst_deviation,
  coalesce(sum(case when d.deviation = 0 then 1 else 0 end), 0)::integer as exact_positions
from public.players p
left join public.table_tip_deviation d on d.player_id = p.id
group by p.id, p.display_name;

grant select on public.table_tip_scores to authenticated;
