-- Stang Inn v1.0 — sesongstart-simulering, steg 1
-- Kjør denne i Supabase SQL Editor.
-- Lager én testkamp 15 minutter frem i tid. Ikke kjør cleanup før hele testen er ferdig.

insert into public.matches (
  external_id,
  season,
  round,
  home_team,
  away_team,
  match_time,
  home_score,
  away_score,
  finished
)
values (
  'SEASON-START-SIM-001',
  '2026/27',
  995,
  'SIM HJEMME',
  'SIM BORTE',
  now() + interval '15 minutes',
  null,
  null,
  false
)
on conflict (external_id) do update set
  season = excluded.season,
  round = excluded.round,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  match_time = excluded.match_time,
  home_score = null,
  away_score = null,
  finished = false;

select id, external_id, round, home_team, away_team, match_time, finished
from public.matches
where external_id = 'SEASON-START-SIM-001';
