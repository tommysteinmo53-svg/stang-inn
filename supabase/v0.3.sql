-- Stang Inn v0.3
-- Kjør hele denne filen i Supabase SQL Editor.
-- Den beholder eksisterende tabeller, men strammer inn tips-reglene og sikrer unik kamp-ID.

alter table public.matches
  add constraint matches_external_id_unique unique (external_id);

-- Sørg for at tips bare kan opprettes/endres av eieren før kampstart.
drop policy if exists "Players can edit own tips" on public.tips;
drop policy if exists "Players can insert own tips before start" on public.tips;
drop policy if exists "Players can update own tips before start" on public.tips;

create policy "Players can insert own tips before start"
on public.tips
for insert
to authenticated
with check (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and coalesce(m.finished, false) = false
      and (m.match_time is null or now() < m.match_time)
  )
);

create policy "Players can update own tips before start"
on public.tips
for update
to authenticated
using (auth.uid() = player_id)
with check (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and coalesce(m.finished, false) = false
      and (m.match_time is null or now() < m.match_time)
  )
);

-- Alle innloggede deltakere kan lese tipsene etter hvert som de lagres.
-- Vi kan senere skjule andres tips frem til kampstart hvis dere ønsker mer pokerfølelse.
drop policy if exists "Players can view all tips" on public.tips;
create policy "Players can view all tips"
on public.tips
for select
to authenticated
using (true);

-- Kamper og spillere skal være lesbare for innloggede deltakere.
drop policy if exists "Everyone can view matches" on public.matches;
create policy "Everyone can view matches"
on public.matches
for select
to authenticated
using (true);

drop policy if exists "Players can view all players" on public.players;
create policy "Players can view all players"
on public.players
for select
to authenticated
using (true);

-- Admin kan vedlikeholde kamper manuelt dersom det blir nødvendig.
create policy "Admin can manage matches"
on public.matches
for all
to authenticated
using (
  exists (select 1 from public.players p where p.id = auth.uid() and p.admin = true)
)
with check (
  exists (select 1 from public.players p where p.id = auth.uid() and p.admin = true)
);
