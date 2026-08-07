-- Stang Inn database
-- Dette skjemaet samsvarer med tabellene som brukes av appen.

create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text unique,
  avatar text,
  admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.matches (
  id bigserial primary key,
  external_id text unique,
  season text,
  round integer,
  home_team text not null,
  away_team text not null,
  match_time timestamptz,
  home_score integer,
  away_score integer,
  finished boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.tips (
  id bigserial primary key,
  player_id uuid references public.players(id) on delete cascade,
  match_id bigint references public.matches(id) on delete cascade,
  home_tip integer not null check (home_tip >= 0),
  away_tip integer not null check (away_tip >= 0),
  points integer default 0,
  created_at timestamptz default now(),
  unique(player_id, match_id)
);

create table if not exists public.table_predictions (
  id bigserial primary key,
  player_id uuid references public.players(id) on delete cascade,
  team text not null,
  position integer not null,
  created_at timestamptz default now(),
  unique(player_id, team),
  unique(player_id, position)
);

create table if not exists public.awards (
  id bigserial primary key,
  player_id uuid references public.players(id) on delete cascade,
  award text not null,
  season text,
  created_at timestamptz default now()
);

alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.tips enable row level security;
alter table public.table_predictions enable row level security;
alter table public.awards enable row level security;

drop policy if exists "Players can view all players" on public.players;
create policy "Players can view all players"
on public.players for select to authenticated
using (true);

drop policy if exists "Players can insert themselves" on public.players;
create policy "Players can insert themselves"
on public.players for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "Players can edit themselves" on public.players;
create policy "Players can edit themselves"
on public.players for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Everyone can view matches" on public.matches;
create policy "Everyone can view matches"
on public.matches for select to authenticated
using (true);

drop policy if exists "Players can view all tips" on public.tips;
create policy "Players can view all tips"
on public.tips for select to authenticated
using (true);

drop policy if exists "Players can insert own tips" on public.tips;
create policy "Players can insert own tips"
on public.tips for insert to authenticated
with check (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.match_time is null or now() < m.match_time)
  )
);

drop policy if exists "Players can update own tips" on public.tips;
create policy "Players can update own tips"
on public.tips for update to authenticated
using (auth.uid() = player_id)
with check (
  auth.uid() = player_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.match_time is null or now() < m.match_time)
  )
);

drop policy if exists "Players can view table tips" on public.table_predictions;
create policy "Players can view table tips"
on public.table_predictions for select to authenticated
using (true);

drop policy if exists "Players can insert own table tips" on public.table_predictions;
create policy "Players can insert own table tips"
on public.table_predictions for insert to authenticated
with check (auth.uid() = player_id);

drop policy if exists "Players can update own table tips" on public.table_predictions;
create policy "Players can update own table tips"
on public.table_predictions for update to authenticated
using (auth.uid() = player_id)
with check (auth.uid() = player_id);

drop policy if exists "Players can delete own table tips" on public.table_predictions;
create policy "Players can delete own table tips"
on public.table_predictions for delete to authenticated
using (auth.uid() = player_id);

drop policy if exists "Everyone can view awards" on public.awards;
create policy "Everyone can view awards"
on public.awards for select to authenticated
using (true);

-- Appen oppretter spillerprofil ved første innlogging hvis den mangler.
-- Sett admin = true manuelt på én spiller i Table Editor når alle har logget inn.
