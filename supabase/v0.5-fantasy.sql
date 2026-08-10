-- Stang Inn Fantasy Hockey – v0.5
-- Core schema for player data, game stats, fantasy scoring and recommendations.

create table if not exists fantasy_players (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  team text not null,
  position text not null check (position in ('G','D','F')),
  price numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fantasy_games (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  season text not null,
  round_no integer,
  starts_at timestamptz not null,
  home_team text not null,
  away_team text not null,
  home_score integer,
  away_score integer,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fantasy_player_game_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references fantasy_players(id) on delete cascade,
  game_id uuid not null references fantasy_games(id) on delete cascade,
  goals integer not null default 0,
  assists integer not null default 0,
  shots integer not null default 0,
  plus_minus integer not null default 0,
  pim integer not null default 0,
  powerplay_goals integer not null default 0,
  shorthanded_goals integer not null default 0,
  game_winning_goals integer not null default 0,
  saves integer not null default 0,
  goals_against integer not null default 0,
  win boolean,
  shutout boolean,
  minutes_played numeric(6,2),
  raw jsonb,
  unique(player_id, game_id)
);

create table if not exists fantasy_scoring_rules (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  key text not null,
  points numeric(8,2) not null,
  position text,
  active boolean not null default true,
  unique(season, key, position)
);

create table if not exists fantasy_player_points (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references fantasy_players(id) on delete cascade,
  game_id uuid not null references fantasy_games(id) on delete cascade,
  actual_points numeric(8,2) not null default 0,
  expected_points numeric(8,2),
  calculation_version text not null default 'v1',
  breakdown jsonb,
  calculated_at timestamptz not null default now(),
  unique(player_id, game_id, calculation_version)
);

create table if not exists fantasy_recommendations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references fantasy_players(id) on delete cascade,
  generated_at timestamptz not null default now(),
  horizon_games integer not null default 3,
  action text not null check (action in ('buy','hold','sell')),
  score numeric(5,2) not null,
  expected_points numeric(8,2),
  fixture_rating numeric(5,2),
  value_score numeric(8,3),
  captain_score numeric(5,2),
  reasoning jsonb
);

create index if not exists fantasy_games_starts_at_idx on fantasy_games(starts_at);
create index if not exists fantasy_players_team_idx on fantasy_players(team);
create index if not exists fantasy_points_player_idx on fantasy_player_points(player_id);
create index if not exists fantasy_recommendations_player_idx on fantasy_recommendations(player_id, generated_at desc);

alter table fantasy_players enable row level security;
alter table fantasy_games enable row level security;
alter table fantasy_player_game_stats enable row level security;
alter table fantasy_scoring_rules enable row level security;
alter table fantasy_player_points enable row level security;
alter table fantasy_recommendations enable row level security;

create policy "Authenticated users can read fantasy players"
on fantasy_players for select to authenticated using (true);

create policy "Authenticated users can read fantasy games"
on fantasy_games for select to authenticated using (true);

create policy "Authenticated users can read fantasy stats"
on fantasy_player_game_stats for select to authenticated using (true);

create policy "Authenticated users can read fantasy rules"
on fantasy_scoring_rules for select to authenticated using (true);

create policy "Authenticated users can read fantasy points"
on fantasy_player_points for select to authenticated using (true);

create policy "Authenticated users can read fantasy recommendations"
on fantasy_recommendations for select to authenticated using (true);
