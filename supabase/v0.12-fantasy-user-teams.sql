-- Stang Inn Fantasy Hockey – v0.12
-- User fantasy teams for 2026/27.
-- Standard roster: 12 players = 2 C, 4 W, 4 D, 2 G. Budget: 100.0m.

create table if not exists fantasy_user_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  season text not null default '2026/27',
  name text not null default 'Mitt lag',
  budget numeric(10,2) not null default 100.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, season)
);

create table if not exists fantasy_user_team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references fantasy_user_teams(id) on delete cascade,
  player_id uuid not null references fantasy_players(id) on delete restrict,
  purchase_price numeric(10,2) not null,
  is_captain boolean not null default false,
  created_at timestamptz not null default now(),
  unique(team_id, player_id)
);

create index if not exists fantasy_user_teams_user_season_idx
  on fantasy_user_teams(user_id, season);
create index if not exists fantasy_user_team_players_team_idx
  on fantasy_user_team_players(team_id);

alter table fantasy_user_teams enable row level security;
alter table fantasy_user_team_players enable row level security;

drop policy if exists "Users can read own fantasy team" on fantasy_user_teams;
create policy "Users can read own fantasy team"
on fantasy_user_teams for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own fantasy team players" on fantasy_user_team_players;
create policy "Users can read own fantasy team players"
on fantasy_user_team_players for select to authenticated
using (exists (
  select 1 from fantasy_user_teams t
  where t.id = fantasy_user_team_players.team_id
    and t.user_id = auth.uid()
));

create or replace function save_fantasy_team_v1(
  p_season text,
  p_name text,
  p_player_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_count integer;
  v_c integer;
  v_w integer;
  v_d integer;
  v_g integer;
  v_total numeric;
  v_distinct integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_season <> '2026/27' then
    raise exception 'Unsupported fantasy season: %', p_season;
  end if;

  v_count := coalesce(array_length(p_player_ids,1),0);
  if v_count <> 12 then
    raise exception 'Team must contain exactly 12 players, got %', v_count;
  end if;

  select count(distinct x) into v_distinct from unnest(p_player_ids) x;
  if v_distinct <> 12 then
    raise exception 'Duplicate players are not allowed';
  end if;

  select
    count(*) filter (where fp.position='C'),
    count(*) filter (where fp.position='W'),
    count(*) filter (where fp.position='D'),
    count(*) filter (where fp.position='G'),
    coalesce(sum(fp.price),0)
  into v_c,v_w,v_d,v_g,v_total
  from fantasy_players fp
  where fp.id = any(p_player_ids)
    and fp.price is not null;

  if (v_c+v_w+v_d+v_g) <> 12 then
    raise exception 'One or more selected players are missing or have no published price';
  end if;

  if v_c<>2 or v_w<>4 or v_d<>4 or v_g<>2 then
    raise exception 'Invalid roster: expected 2C/4W/4D/2G, got %C/%W/%D/%G',v_c,v_w,v_d,v_g;
  end if;

  if v_total > 100.00 then
    raise exception 'Budget exceeded: %m > 100.0m',v_total;
  end if;

  insert into fantasy_user_teams(user_id,season,name,budget,updated_at)
  values(v_user,p_season,coalesce(nullif(trim(p_name),''),'Mitt lag'),100.00,now())
  on conflict(user_id,season) do update
    set name=excluded.name,budget=excluded.budget,updated_at=now()
  returning id into v_team;

  delete from fantasy_user_team_players where team_id=v_team;

  insert into fantasy_user_team_players(team_id,player_id,purchase_price)
  select v_team,fp.id,fp.price
  from fantasy_players fp
  where fp.id=any(p_player_ids);

  return v_team;
end;
$$;

revoke all on function save_fantasy_team_v1(text,text,uuid[]) from public;
grant execute on function save_fantasy_team_v1(text,text,uuid[]) to authenticated;
