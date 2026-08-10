-- Stang Inn Fantasy Hockey – v0.7
-- Season-stat snapshots + safe delta materialization.

create table if not exists fantasy_snapshot_batches (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  source text not null default 'hockeylive-public',
  captured_at timestamptz not null default now(),
  player_rows integer not null default 0,
  goalie_rows integer not null default 0,
  status text not null default 'captured',
  note text
);

create table if not exists fantasy_stat_snapshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references fantasy_snapshot_batches(id) on delete cascade,
  season text not null,
  player_key text not null,
  name text not null,
  team text not null,
  kind text not null check (kind in ('skater','goalie')),
  position text,
  games_played integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  shots integer not null default 0,
  plus_minus integer not null default 0,
  pim integer not null default 0,
  wins integer not null default 0,
  shutouts integer not null default 0,
  saves integer not null default 0,
  goals_against integer not null default 0,
  raw jsonb,
  captured_at timestamptz not null default now(),
  unique(batch_id, player_key, kind)
);

create index if not exists fantasy_snapshot_batches_season_time_idx
  on fantasy_snapshot_batches(season, captured_at desc);

create index if not exists fantasy_stat_snapshots_player_time_idx
  on fantasy_stat_snapshots(season, player_key, kind, captured_at desc);

alter table fantasy_snapshot_batches enable row level security;
alter table fantasy_stat_snapshots enable row level security;

-- Snapshot tables are server-managed. No browser policies are created intentionally.
