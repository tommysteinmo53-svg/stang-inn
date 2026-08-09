-- Stang Inn v1.0 — produksjonsherding / dataintegritet
-- Kjør hele filen i Supabase SQL Editor.

-- 1) Kampresultater kan ikke være negative.
alter table public.matches
  drop constraint if exists matches_scores_nonnegative;
alter table public.matches
  add constraint matches_scores_nonnegative
  check (
    (home_score is null or home_score >= 0)
    and (away_score is null or away_score >= 0)
  ) not valid;
alter table public.matches validate constraint matches_scores_nonnegative;

-- 2) En kamp som er markert ferdig må ha komplett sluttresultat.
alter table public.matches
  drop constraint if exists matches_finished_requires_score;
alter table public.matches
  add constraint matches_finished_requires_score
  check (
    not finished
    or (home_score is not null and away_score is not null)
  ) not valid;
alter table public.matches validate constraint matches_finished_requires_score;

-- 3) Forsvar i dybden: tipsfelt kan aldri endres etter kampstart,
-- selv om en fremtidig klient/RLS-policy ved en feil skulle bli for åpen.
create or replace function public.guard_tip_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kickoff timestamptz;
begin
  select m.match_time into kickoff
  from public.matches m
  where m.id = new.match_id;

  if kickoff is null then
    raise exception 'Kampen mangler kampstart og kan ikke tippes';
  end if;

  if now() >= kickoff then
    raise exception 'Tipset er låst fordi kampen har startet';
  end if;

  return new;
end;
$$;

drop trigger if exists tips_deadline_guard on public.tips;
create trigger tips_deadline_guard
before insert or update of player_id, match_id, home_tip, away_tip
on public.tips
for each row
execute function public.guard_tip_deadline();

-- 4) Integritetsrapport. Denne gjør ingen endringer og kan kjøres når som helst.
create or replace view public.data_integrity_report as
select
  (select count(*) from public.matches) as matches_total,
  (select count(*) from public.matches where external_id is null) as matches_without_external_id,
  (select count(*) from public.matches where finished and (home_score is null or away_score is null)) as finished_without_score,
  (select count(*) from public.matches where coalesce(home_score,0) < 0 or coalesce(away_score,0) < 0) as negative_scores,
  (select count(*) from public.tips t join public.matches m on m.id=t.match_id where m.finished and t.points is null) as finished_tips_without_points,
  (select count(*) from public.tips t join public.matches m on m.id=t.match_id where t.created_at >= m.match_time and m.match_time is not null) as tips_created_after_kickoff,
  (select count(*) from (
     select external_id from public.matches
     where external_id is not null
     group by external_id having count(*) > 1
   ) d) as duplicate_external_ids,
  (select count(*) from (
     select player_id, match_id from public.tips
     group by player_id, match_id having count(*) > 1
   ) d) as duplicate_player_match_tips;

revoke all on public.data_integrity_report from anon;
grant select on public.data_integrity_report to authenticated;

-- Forventet før sesongstart akkurat nå:
-- matches_total = 225
-- alle andre kolonner = 0
select * from public.data_integrity_report;
