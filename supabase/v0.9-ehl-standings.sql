-- Stang Inn v0.9 – gjeldende EHL-tabell
-- Kjør hele filen i Supabase SQL Editor etter v0.8-tabelltips-migrasjonene.

create table if not exists public.ehl_standings (
  id bigserial primary key,
  season text not null,
  team text not null,
  position integer not null check (position between 1 and 10),
  played integer not null default 0 check (played >= 0),
  points integer not null default 0,
  source text,
  synced_at timestamptz not null default now(),
  unique (season, team),
  unique (season, position)
);

alter table public.ehl_standings enable row level security;

drop policy if exists "Authenticated users can view EHL standings" on public.ehl_standings;
create policy "Authenticated users can view EHL standings"
on public.ehl_standings
for select
to authenticated
using (true);

grant select on table public.ehl_standings to authenticated;

create or replace view public.table_tip_deviation as
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

create or replace view public.table_tip_scores as
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
