-- Stang Inn Fantasy Hockey – v0.33
-- Private leagues for 2026/27.
-- One fantasy team per user/season is reused across every private league.
-- League tables do NOT duplicate fantasy scoring; standings reuse get_fantasy_season_leaderboard().

create table if not exists fantasy_private_leagues (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fantasy_private_league_members (
  league_id uuid not null references fantasy_private_leagues(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id)
);

create index if not exists fantasy_private_leagues_season_idx
  on fantasy_private_leagues(season,created_at desc);
create index if not exists fantasy_private_league_members_user_idx
  on fantasy_private_league_members(user_id,joined_at desc);

alter table fantasy_private_leagues enable row level security;
alter table fantasy_private_league_members enable row level security;

-- No direct browser policies are created intentionally.
-- Reads/writes go through SECURITY DEFINER RPCs below so membership and invite-code
-- visibility are enforced in one place.

create or replace function create_fantasy_private_league_v1(
  p_season text,
  p_name text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_name text:=btrim(coalesce(p_name,''));
  v_code text;
  v_league uuid;
  v_try integer:=0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  if char_length(v_name)<2 or char_length(v_name)>60 then
    raise exception 'League name must be 2–60 characters';
  end if;

  if not exists(
    select 1 from fantasy_user_teams t
    where t.user_id=v_user and t.season=p_season
  ) then
    raise exception 'Create your Fantasy team before creating a private league';
  end if;

  loop
    v_try:=v_try+1;
    v_code:=upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
    begin
      insert into fantasy_private_leagues(season,name,invite_code,created_by)
      values(p_season,v_name,v_code,v_user)
      returning id into v_league;
      exit;
    exception when unique_violation then
      if v_try>=10 then raise exception 'Could not generate unique invite code'; end if;
    end;
  end loop;

  insert into fantasy_private_league_members(league_id,user_id,role)
  values(v_league,v_user,'owner');

  return v_league;
end;
$$;

revoke all on function create_fantasy_private_league_v1(text,text) from public;
grant execute on function create_fantasy_private_league_v1(text,text) to authenticated;


create or replace function join_fantasy_private_league_v1(
  p_season text,
  p_invite_code text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_code text:=upper(regexp_replace(coalesce(p_invite_code,''),'[^A-Za-z0-9]','','g'));
  v_league uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  if char_length(v_code)<>8 then raise exception 'Invite code must contain 8 characters'; end if;

  if not exists(
    select 1 from fantasy_user_teams t
    where t.user_id=v_user and t.season=p_season
  ) then
    raise exception 'Create your Fantasy team before joining a private league';
  end if;

  select l.id into v_league
  from fantasy_private_leagues l
  where l.season=p_season and l.invite_code=v_code;

  if v_league is null then raise exception 'Private league not found'; end if;

  insert into fantasy_private_league_members(league_id,user_id,role)
  values(v_league,v_user,'member')
  on conflict(league_id,user_id) do nothing;

  return v_league;
end;
$$;

revoke all on function join_fantasy_private_league_v1(text,text) from public;
grant execute on function join_fantasy_private_league_v1(text,text) to authenticated;


create or replace function get_my_fantasy_private_leagues_v1(
  p_season text
) returns table(
  league_id uuid,
  league_name text,
  invite_code text,
  my_role text,
  member_count integer,
  created_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select
    l.id,
    l.name,
    l.invite_code,
    mine.role,
    count(allm.user_id)::integer,
    l.created_at
  from fantasy_private_league_members mine
  join fantasy_private_leagues l on l.id=mine.league_id
  join fantasy_private_league_members allm on allm.league_id=l.id
  where mine.user_id=auth.uid()
    and l.season=p_season
  group by l.id,l.name,l.invite_code,mine.role,l.created_at
  order by l.created_at desc,l.name;
$$;

revoke all on function get_my_fantasy_private_leagues_v1(text) from public;
grant execute on function get_my_fantasy_private_leagues_v1(text) to authenticated;


create or replace function get_fantasy_private_league_standings_v1(
  p_league_id uuid,
  p_season text
) returns table(
  standings_position bigint,
  user_id uuid,
  display_name text,
  team_id uuid,
  team_name text,
  total_points numeric,
  rounds_scored integer,
  round_wins integer,
  best_round_points numeric,
  average_round_points numeric,
  last_round_no integer,
  last_round_points numeric,
  member_role text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  if not exists(
    select 1 from fantasy_private_league_members m
    join fantasy_private_leagues l on l.id=m.league_id
    where m.league_id=p_league_id
      and m.user_id=auth.uid()
      and l.season=p_season
  ) then
    raise exception 'You are not a member of this private league';
  end if;

  return query
  with member_rows as (
    select
      m.user_id,
      m.role,
      m.joined_at,
      t.id as team_id,
      t.name as team_name,
      coalesce(p.display_name,'Fantasyspiller') as display_name
    from fantasy_private_league_members m
    join fantasy_private_leagues l on l.id=m.league_id and l.season=p_season
    left join fantasy_user_teams t on t.user_id=m.user_id and t.season=p_season
    left join players p on p.id=m.user_id
    where m.league_id=p_league_id
  ), board as (
    select * from get_fantasy_season_leaderboard(p_season)
  ), combined as (
    select
      mr.user_id,
      mr.display_name,
      mr.team_id,
      coalesce(mr.team_name,'Ikke opprettet lag') as team_name,
      coalesce(b.total_points,0)::numeric as total_points,
      coalesce(b.rounds_scored,0)::integer as rounds_scored,
      coalesce(b.round_wins,0)::integer as round_wins,
      coalesce(b.best_round_points,0)::numeric as best_round_points,
      coalesce(b.average_round_points,0)::numeric as average_round_points,
      b.last_round_no::integer as last_round_no,
      b.last_round_points::numeric as last_round_points,
      mr.role,
      mr.joined_at
    from member_rows mr
    left join board b on b.team_id=mr.team_id
  )
  select
    dense_rank() over(order by c.total_points desc,c.team_name,c.user_id),
    c.user_id,
    c.display_name,
    c.team_id,
    c.team_name,
    c.total_points,
    c.rounds_scored,
    c.round_wins,
    c.best_round_points,
    c.average_round_points,
    c.last_round_no,
    c.last_round_points,
    c.role,
    c.joined_at
  from combined c
  order by c.total_points desc,c.team_name,c.user_id;
end;
$$;

revoke all on function get_fantasy_private_league_standings_v1(uuid,text) from public;
grant execute on function get_fantasy_private_league_standings_v1(uuid,text) to authenticated;

comment on table fantasy_private_leagues is
  'Fantasy-only private leagues. Hockeytips leagues will use a separate scoring/membership layer later.';
comment on table fantasy_private_league_members is
  'Membership maps users to leagues; the same fantasy_user_teams row is reused in every league for a season.';
