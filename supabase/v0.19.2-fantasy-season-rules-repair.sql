-- Stang Inn Fantasy Hockey – v0.19.2
-- Repair installations where v0.13 fantasy_season_rules was never created.
-- Safe to run repeatedly.

create table if not exists fantasy_season_rules (
  season text primary key,
  max_players_per_club integer not null default 3 check (max_players_per_club > 0),
  captain_multiplier numeric(4,2) not null default 2.00 check (captain_multiplier >= 1),
  vice_captain_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into fantasy_season_rules(
  season,
  max_players_per_club,
  captain_multiplier,
  vice_captain_enabled,
  updated_at
)
values(
  '2026/27',
  3,
  2.00,
  true,
  now()
)
on conflict(season) do update set
  max_players_per_club=excluded.max_players_per_club,
  captain_multiplier=excluded.captain_multiplier,
  vice_captain_enabled=excluded.vice_captain_enabled,
  updated_at=now();

alter table fantasy_season_rules enable row level security;

drop policy if exists "Authenticated users can read fantasy season rules"
on fantasy_season_rules;

create policy "Authenticated users can read fantasy season rules"
on fantasy_season_rules
for select
to authenticated
using (true);

-- Also ensure the vice-captain column from v0.13 exists.
alter table fantasy_user_team_players
  add column if not exists is_vice_captain boolean not null default false;

-- Verification: fail loudly if the expected 2026/27 rule row is missing.
do $$
declare
  v_max integer;
  v_multiplier numeric;
  v_vice boolean;
begin
  select max_players_per_club,captain_multiplier,vice_captain_enabled
  into v_max,v_multiplier,v_vice
  from fantasy_season_rules
  where season='2026/27';

  if not found then
    raise exception 'Repair failed: fantasy_season_rules row for 2026/27 is missing';
  end if;

  if v_max is null or v_multiplier is null or v_vice is null then
    raise exception 'Repair failed: incomplete fantasy_season_rules row for 2026/27';
  end if;
end;
$$;
