-- Stang Inn Fantasy Hockey – v0.16
-- Round/deadline foundation and immutable team snapshots.
-- A user's live team can keep changing before a deadline; the round snapshot is
-- the roster that earns points for that round.

create table if not exists fantasy_rounds (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  round_no integer not null,
  name text,
  starts_at timestamptz,
  deadline_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','open','locked','finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season,round_no)
);

alter table fantasy_games
  add column if not exists fantasy_round_id uuid references fantasy_rounds(id) on delete set null;

create index if not exists fantasy_rounds_season_deadline_idx
  on fantasy_rounds(season,deadline_at);
create index if not exists fantasy_games_round_idx
  on fantasy_games(fantasy_round_id);

create table if not exists fantasy_team_round_snapshots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references fantasy_rounds(id) on delete cascade,
  team_id uuid not null references fantasy_user_teams(id) on delete cascade,
  user_id uuid not null,
  season text not null,
  team_name text not null,
  squad_value numeric(10,2) not null default 0,
  captured_at timestamptz not null default now(),
  unique(round_id,team_id)
);

create table if not exists fantasy_team_round_snapshot_players (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references fantasy_team_round_snapshots(id) on delete cascade,
  player_id uuid not null references fantasy_players(id) on delete restrict,
  position text not null,
  team text not null,
  price numeric(10,2) not null,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  created_at timestamptz not null default now(),
  unique(snapshot_id,player_id)
);

create index if not exists fantasy_snapshot_user_idx
  on fantasy_team_round_snapshots(user_id,season);
create index if not exists fantasy_snapshot_players_snapshot_idx
  on fantasy_team_round_snapshot_players(snapshot_id);

alter table fantasy_rounds enable row level security;
alter table fantasy_team_round_snapshots enable row level security;
alter table fantasy_team_round_snapshot_players enable row level security;

-- Round schedule is public to authenticated fantasy users.
drop policy if exists "Authenticated users can read fantasy rounds" on fantasy_rounds;
create policy "Authenticated users can read fantasy rounds"
on fantasy_rounds for select to authenticated using (true);

-- Users can only read their own frozen teams.
drop policy if exists "Users can read own fantasy snapshots" on fantasy_team_round_snapshots;
create policy "Users can read own fantasy snapshots"
on fantasy_team_round_snapshots for select to authenticated
using (user_id=auth.uid());

drop policy if exists "Users can read own fantasy snapshot players" on fantasy_team_round_snapshot_players;
create policy "Users can read own fantasy snapshot players"
on fantasy_team_round_snapshot_players for select to authenticated
using (
  exists (
    select 1 from fantasy_team_round_snapshots s
    where s.id=snapshot_id and s.user_id=auth.uid()
  )
);

-- Freeze the authenticated user's current team for one round.
-- The function refuses early snapshots: it may only run once the deadline has passed.
create or replace function snapshot_fantasy_team_for_round(
  p_round_id uuid
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round fantasy_rounds%rowtype;
  v_team fantasy_user_teams%rowtype;
  v_snapshot uuid;
  v_count integer;
  v_f integer;
  v_d integer;
  v_g integer;
  v_captains integer;
  v_vice integer;
  v_value numeric;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_round from fantasy_rounds where id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;
  if now() < v_round.deadline_at then
    raise exception 'Round is not locked yet. Deadline is %',v_round.deadline_at;
  end if;

  select * into v_team
  from fantasy_user_teams
  where user_id=v_user and season=v_round.season;
  if not found then raise exception 'No fantasy team found for season %',v_round.season; end if;

  select
    count(*),
    count(*) filter(where fp.position in ('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G'),
    count(*) filter(where tp.is_captain),
    count(*) filter(where tp.is_vice_captain),
    coalesce(sum(tp.purchase_price),0)
  into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then
    raise exception 'Cannot snapshot invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g;
  end if;
  if v_captains<>1 or v_vice<>1 then
    raise exception 'Cannot snapshot team without exactly one captain and one vice-captain';
  end if;

  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at
  ) values(
    v_round.id,v_team.id,v_user,v_round.season,v_team.name,v_value,now()
  )
  on conflict(round_id,team_id) do nothing
  returning id into v_snapshot;

  -- Immutable: if this round/team was already frozen, return the existing snapshot.
  if v_snapshot is null then
    select id into v_snapshot
    from fantasy_team_round_snapshots
    where round_id=v_round.id and team_id=v_team.id;
    return v_snapshot;
  end if;

  insert into fantasy_team_round_snapshot_players(
    snapshot_id,player_id,position,team,price,is_captain,is_vice_captain
  )
  select
    v_snapshot,fp.id,fp.position,fp.team,tp.purchase_price,
    tp.is_captain,tp.is_vice_captain
  from fantasy_user_team_players tp
  join fantasy_players fp on fp.id=tp.player_id
  where tp.team_id=v_team.id;

  return v_snapshot;
end;
$$;

revoke all on function snapshot_fantasy_team_for_round(uuid) from public;
grant execute on function snapshot_fantasy_team_for_round(uuid) to authenticated;

-- Convenience helper for the current/next round in a season.
create or replace function get_fantasy_round_state(p_season text)
returns table(
  round_id uuid,
  round_no integer,
  round_name text,
  deadline_at timestamptz,
  status text,
  locked boolean
)
language sql
stable
security definer
set search_path=public
as $$
  select r.id,r.round_no,r.name,r.deadline_at,r.status,(now()>=r.deadline_at)
  from fantasy_rounds r
  where r.season=p_season
    and coalesce(r.ends_at,r.deadline_at + interval '7 days') >= now()
  order by r.deadline_at
  limit 1;
$$;

revoke all on function get_fantasy_round_state(text) from public;
grant execute on function get_fantasy_round_state(text) to authenticated;
