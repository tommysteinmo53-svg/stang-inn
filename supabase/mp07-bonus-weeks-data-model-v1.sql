-- Stang Inn XI – MP-07.6B
-- Bonus Weeks / Event Weeks data model v1.
-- DATA MODEL ONLY: does not change scoring, transfers, snapshots or deadlines.
-- Event rosters are deliberately separate from fantasy_user_team_players so
-- Rik/Fattig Onkel can never overwrite the permanent 100m roster.

create table if not exists fantasy_bonus_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  team_id uuid not null references fantasy_user_teams(id) on delete cascade,
  season text not null,
  round_id uuid not null references fantasy_rounds(id) on delete restrict,
  booster_type text not null check (booster_type in ('captain_boost','line_boost','transfer_boost')),
  status text not null default 'selected' check (status in ('selected','committed','used','cancelled')),
  committed_at timestamptz,
  used_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, season, booster_type)
);

-- Only one live personal booster may target a team/round. Cancelled selections
-- do not block a later selection, while the season/type uniqueness preserves
-- one inventory slot per booster and lets activation RPCs reuse the row.
create unique index if not exists fantasy_bonus_activations_team_round_live_uidx
  on fantasy_bonus_activations(team_id, round_id)
  where status in ('selected','committed','used');
create index if not exists fantasy_bonus_activations_user_season_idx
  on fantasy_bonus_activations(user_id, season);
create index if not exists fantasy_bonus_activations_round_idx
  on fantasy_bonus_activations(round_id);

create table if not exists fantasy_event_weeks (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  round_id uuid not null references fantasy_rounds(id) on delete restrict,
  event_type text not null check (event_type in ('rich_uncle','poor_uncle')),
  event_budget numeric(10,2) not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season, event_type),
  unique(round_id),
  check (
    (event_type='rich_uncle' and event_budget=200.00)
    or (event_type='poor_uncle' and event_budget=70.00)
  )
);

create index if not exists fantasy_event_weeks_season_round_idx
  on fantasy_event_weeks(season, round_id);

create table if not exists fantasy_event_teams (
  id uuid primary key default gen_random_uuid(),
  event_week_id uuid not null references fantasy_event_weeks(id) on delete cascade,
  permanent_team_id uuid not null references fantasy_user_teams(id) on delete cascade,
  user_id uuid not null,
  season text not null,
  name text not null default 'Eventlag',
  budget numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_week_id, permanent_team_id),
  unique(event_week_id, user_id)
);

create index if not exists fantasy_event_teams_user_season_idx
  on fantasy_event_teams(user_id, season);
create index if not exists fantasy_event_teams_permanent_team_idx
  on fantasy_event_teams(permanent_team_id);

create table if not exists fantasy_event_team_players (
  id uuid primary key default gen_random_uuid(),
  event_team_id uuid not null references fantasy_event_teams(id) on delete cascade,
  player_id uuid not null references fantasy_players(id) on delete restrict,
  purchase_price numeric(10,2) not null,
  line_no smallint not null check (line_no in (1,2)),
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  created_at timestamptz not null default now(),
  unique(event_team_id, player_id),
  check (not (is_captain and is_vice_captain))
);

create index if not exists fantasy_event_team_players_team_idx
  on fantasy_event_team_players(event_team_id);

-- RLS: users may read their own state. Writes are intentionally withheld in
-- 07.6B; later SECURITY DEFINER RPCs will own all mutations and enforce
-- deadline, budget, roster, club, C/VC and event rules server-side.
alter table fantasy_bonus_activations enable row level security;
alter table fantasy_event_weeks enable row level security;
alter table fantasy_event_teams enable row level security;
alter table fantasy_event_team_players enable row level security;

drop policy if exists "Users can read own fantasy bonus activations" on fantasy_bonus_activations;
create policy "Users can read own fantasy bonus activations"
on fantasy_bonus_activations for select to authenticated
using (
  user_id=auth.uid()
  and exists (
    select 1 from fantasy_user_teams t
    where t.id=fantasy_bonus_activations.team_id
      and t.user_id=auth.uid()
      and t.season=fantasy_bonus_activations.season
  )
);

drop policy if exists "Authenticated users can read published fantasy event weeks" on fantasy_event_weeks;
create policy "Authenticated users can read published fantasy event weeks"
on fantasy_event_weeks for select to authenticated
using (is_published=true);

drop policy if exists "Users can read own fantasy event teams" on fantasy_event_teams;
create policy "Users can read own fantasy event teams"
on fantasy_event_teams for select to authenticated
using (
  user_id=auth.uid()
  and exists (
    select 1 from fantasy_user_teams t
    where t.id=fantasy_event_teams.permanent_team_id
      and t.user_id=auth.uid()
      and t.season=fantasy_event_teams.season
  )
);

drop policy if exists "Users can read own fantasy event team players" on fantasy_event_team_players;
create policy "Users can read own fantasy event team players"
on fantasy_event_team_players for select to authenticated
using (
  exists (
    select 1
    from fantasy_event_teams et
    join fantasy_user_teams t on t.id=et.permanent_team_id
    where et.id=fantasy_event_team_players.event_team_id
      and et.user_id=auth.uid()
      and t.user_id=auth.uid()
  )
);

-- Defense in depth: direct client writes are not granted. The tables are
-- mutated only by future controlled RPCs/service operations.
revoke insert, update, delete on fantasy_bonus_activations from authenticated;
revoke insert, update, delete on fantasy_event_weeks from authenticated;
revoke insert, update, delete on fantasy_event_teams from authenticated;
revoke insert, update, delete on fantasy_event_team_players from authenticated;

comment on table fantasy_bonus_activations is
  'MP-07.6 personal booster inventory/selection. One row per team/season/booster; mutations must enforce deadline and Event Week exclusions.';
comment on table fantasy_event_weeks is
  'MP-07.6 shared Rik Onkel/Fattig Onkel round configuration. Budgets are fixed to 200m/70m by constraint.';
comment on table fantasy_event_teams is
  'MP-07.6 temporary event-team header linked to, but never replacing, the permanent 100m fantasy team.';
comment on table fantasy_event_team_players is
  'MP-07.6 temporary event roster with independent lines and C/VC; never used as permanent transfer history.';
