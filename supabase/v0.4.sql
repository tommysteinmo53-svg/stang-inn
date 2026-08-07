-- Stang Inn v0.4 – klargjør automatisk EHL-synk

-- EHL-kampene må kunne upsertes stabilt fra NIF/HockeyLive.
create unique index if not exists matches_external_id_unique
on public.matches (external_id)
where external_id is not null;

-- Vanlige innloggede brukere kan lese kamper.
drop policy if exists "Everyone can view matches" on public.matches;
create policy "Authenticated users can view matches"
on public.matches
for select
to authenticated
using (true);

-- Ingen klientbruker får skrive til matches-tabellen.
-- Serversynk bruker Supabase Secret key og omgår RLS.

-- Tips kan leses av innloggede brukere etter kampstart.
drop policy if exists "Players can view all tips" on public.tips;
create policy "Authenticated users can view tips"
on public.tips
for select
to authenticated
using (true);
