-- Stang Inn v0.9 — hardening av tips før sesongstart
-- Kjør hele filen i Supabase SQL Editor.

-- 1) Andre spilleres tips skal være skjult frem til kampstart.
drop policy if exists "Players can view all tips" on public.tips;
drop policy if exists "Players can view visible tips" on public.tips;
create policy "Players can view visible tips"
on public.tips for select to authenticated
using (
  auth.uid() = player_id
  or exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.match_time is not null
      and now() >= m.match_time
  )
);

-- 2) Brukere kan fortsatt opprette/endre egne tips, men bare før kampstart.
drop policy if exists "Players can insert own tips" on public.tips;
create policy "Players can insert own tips"
on public.tips for insert to authenticated
with check (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.match_time is not null
      and now() < m.match_time
  )
);

drop policy if exists "Players can update own tips" on public.tips;
create policy "Players can update own tips"
on public.tips for update to authenticated
using (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.match_time is not null
      and now() < m.match_time
  )
)
with check (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.match_time is not null
      and now() < m.match_time
  )
);

-- 3) Poeng skal aldri kunne manipuleres fra nettleseren.
-- Klientrollen får bare skrive selve tipset. Server/service-role kan fortsatt score kampene.
revoke insert, update on table public.tips from authenticated;
grant select on table public.tips to authenticated;
grant insert (player_id, match_id, home_tip, away_tip) on table public.tips to authenticated;
grant update (home_tip, away_tip) on table public.tips to authenticated;

-- 4) Ingen skal kunne slette et låst tips via klienten.
drop policy if exists "Players can delete own tips" on public.tips;
create policy "Players can delete own unlocked tips"
on public.tips for delete to authenticated
using (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.match_time is not null
      and now() < m.match_time
  )
);
grant delete on table public.tips to authenticated;

-- Kontroll etter kjøring:
-- A) Eget tips skal kunne leses før kampstart.
-- B) En annen brukers tips skal ikke være synlig før kampstart.
-- C) Etter kampstart skal tips ikke kunne endres eller slettes.
-- D) authenticated skal ikke kunne sette points direkte.
