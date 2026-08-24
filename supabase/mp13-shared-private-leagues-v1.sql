-- MP-13.6 – shared Stang Inn mini leagues across Tipping and Fantasy
-- Preserves every legacy league id, invite code, owner and membership.
-- Legacy product tables remain intact as migration/audit history; all active RPCs use the canonical shared model.

begin;

-- Fail before touching data if the two legacy namespaces cannot be merged losslessly.
do $$
begin
  if exists (
    select 1
    from public.fantasy_private_leagues f
    join public.hockeytips_private_leagues h on h.id = f.id
    where (f.season,f.name,f.invite_code,f.created_by,f.created_at)
      is distinct from
          (h.season,h.name,h.invite_code,h.created_by,h.created_at)
  ) then
    raise exception 'MP-13.6 blocked: conflicting legacy league ids';
  end if;

  if exists (
    select 1
    from public.fantasy_private_leagues f
    join public.hockeytips_private_leagues h on h.invite_code = f.invite_code
    where h.id <> f.id
  ) then
    raise exception 'MP-13.6 blocked: conflicting legacy invite codes';
  end if;
end $$;

create table if not exists public.stang_inn_private_leagues (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint stang_inn_private_leagues_name_check check (char_length(btrim(name)) between 2 and 40),
  constraint stang_inn_private_leagues_season_check check (char_length(btrim(season)) > 0)
);

create table if not exists public.stang_inn_private_league_members (
  league_id uuid not null references public.stang_inn_private_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id),
  constraint stang_inn_private_league_members_role_check check (role in ('owner','member'))
);

create table if not exists public.stang_inn_private_league_migration_audit (
  source_product text not null check (source_product in ('fantasy','tipping')),
  source_league_id uuid not null,
  canonical_league_id uuid not null references public.stang_inn_private_leagues(id) on delete cascade,
  invite_code text not null,
  migrated_at timestamptz not null default now(),
  primary key (source_product,source_league_id)
);

alter table public.stang_inn_private_leagues enable row level security;
alter table public.stang_inn_private_league_members enable row level security;
alter table public.stang_inn_private_league_migration_audit enable row level security;

revoke all on table public.stang_inn_private_leagues from public, anon, authenticated;
revoke all on table public.stang_inn_private_league_members from public, anon, authenticated;
revoke all on table public.stang_inn_private_league_migration_audit from public, anon, authenticated;

-- Preserve Fantasy leagues first, then any distinct Tipping leagues.
insert into public.stang_inn_private_leagues(id,season,name,invite_code,created_by,created_at)
select id,season,name,invite_code,created_by,created_at
from public.fantasy_private_leagues
on conflict (id) do nothing;

insert into public.stang_inn_private_leagues(id,season,name,invite_code,created_by,created_at)
select id,season,name,invite_code,created_by,created_at
from public.hockeytips_private_leagues
on conflict (id) do nothing;

-- One canonical membership. If an identical legacy league ever existed in both products,
-- preserve owner precedence and the earliest joined_at.
insert into public.stang_inn_private_league_members(league_id,user_id,role,joined_at)
select league_id,user_id,role,joined_at from public.fantasy_private_league_members
on conflict (league_id,user_id) do update
set role = case when excluded.role='owner' or stang_inn_private_league_members.role='owner' then 'owner' else 'member' end,
    joined_at = least(stang_inn_private_league_members.joined_at,excluded.joined_at);

insert into public.stang_inn_private_league_members(league_id,user_id,role,joined_at)
select league_id,user_id,role,joined_at from public.hockeytips_private_league_members
on conflict (league_id,user_id) do update
set role = case when excluded.role='owner' or stang_inn_private_league_members.role='owner' then 'owner' else 'member' end,
    joined_at = least(stang_inn_private_league_members.joined_at,excluded.joined_at);

insert into public.stang_inn_private_league_migration_audit(source_product,source_league_id,canonical_league_id,invite_code)
select 'fantasy',id,id,invite_code from public.fantasy_private_leagues
on conflict (source_product,source_league_id) do update
set canonical_league_id=excluded.canonical_league_id, invite_code=excluded.invite_code;

insert into public.stang_inn_private_league_migration_audit(source_product,source_league_id,canonical_league_id,invite_code)
select 'tipping',id,id,invite_code from public.hockeytips_private_leagues
on conflict (source_product,source_league_id) do update
set canonical_league_id=excluded.canonical_league_id, invite_code=excluded.invite_code;

-- Lossless migration assertions.
do $$
begin
  if exists (
    (select id,season,name,invite_code,created_by,created_at from public.fantasy_private_leagues
     except
     select id,season,name,invite_code,created_by,created_at from public.stang_inn_private_leagues)
    union all
    (select id,season,name,invite_code,created_by,created_at from public.hockeytips_private_leagues
     except
     select id,season,name,invite_code,created_by,created_at from public.stang_inn_private_leagues)
  ) then
    raise exception 'MP-13.6 migration verification failed: missing legacy league';
  end if;

  if exists (
    (select league_id,user_id from public.fantasy_private_league_members
     except
     select league_id,user_id from public.stang_inn_private_league_members)
    union all
    (select league_id,user_id from public.hockeytips_private_league_members
     except
     select league_id,user_id from public.stang_inn_private_league_members)
  ) then
    raise exception 'MP-13.6 migration verification failed: missing legacy membership';
  end if;

  if exists (
    select 1
    from public.stang_inn_private_leagues l
    left join public.stang_inn_private_league_members m on m.league_id=l.id
    group by l.id,l.created_by
    having count(*) filter(where m.role='owner') <> 1
       or not coalesce(bool_or(m.role='owner' and m.user_id=l.created_by),false)
  ) then
    raise exception 'MP-13.6 migration verification failed: owner invariant';
  end if;
end $$;

create or replace function public.create_stang_inn_private_league_v1(p_season text,p_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  league_id uuid;
  code text;
  clean_name text := btrim(coalesce(p_name,''));
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_season is null or btrim(p_season)='' then raise exception 'Season is required'; end if;
  if char_length(clean_name) not between 2 and 40 then raise exception 'Liganavn må være mellom 2 og 40 tegn'; end if;

  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text || uid::text),1,8));
    exit when not exists(select 1 from public.stang_inn_private_leagues where invite_code=code);
  end loop;

  insert into public.stang_inn_private_leagues(season,name,invite_code,created_by)
  values (p_season,clean_name,code,uid)
  returning id into league_id;

  insert into public.stang_inn_private_league_members(league_id,user_id,role)
  values (league_id,uid,'owner');

  return league_id;
end;
$$;

create or replace function public.join_stang_inn_private_league_v1(p_season text,p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  league_id uuid;
  clean_code text := upper(btrim(coalesce(p_invite_code,'')));
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if clean_code='' then raise exception 'Invitasjonskode mangler'; end if;

  select l.id into league_id
  from public.stang_inn_private_leagues l
  where l.season=p_season and l.invite_code=clean_code;

  if league_id is null then raise exception 'Fant ingen miniliga med denne koden'; end if;

  insert into public.stang_inn_private_league_members(league_id,user_id,role)
  values (league_id,uid,'member')
  on conflict (league_id,user_id) do nothing;

  return league_id;
end;
$$;

create or replace function public.get_my_stang_inn_private_leagues_v1(p_season text)
returns table(league_id uuid,league_name text,invite_code text,my_role text,member_count integer,created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return query
  select l.id,l.name,l.invite_code,mine.role,count(allm.user_id)::integer,l.created_at
  from public.stang_inn_private_league_members mine
  join public.stang_inn_private_leagues l on l.id=mine.league_id
  join public.stang_inn_private_league_members allm on allm.league_id=l.id
  where mine.user_id=auth.uid() and l.season=p_season
  group by l.id,l.name,l.invite_code,mine.role,l.created_at
  order by l.created_at desc,l.name;
end;
$$;

create or replace function public.leave_stang_inn_private_league_v1(p_league_id uuid,p_season text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  member_role text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select m.role into member_role
  from public.stang_inn_private_league_members m
  join public.stang_inn_private_leagues l on l.id=m.league_id
  where m.league_id=p_league_id and m.user_id=uid and l.season=p_season;
  if member_role is null then raise exception 'Du er ikke medlem av denne miniligaen'; end if;
  if member_role='owner' then raise exception 'Ligaeier kan ikke melde seg ut. Eierskapet må beholdes for å unngå tap av ligaen.'; end if;
  delete from public.stang_inn_private_league_members where league_id=p_league_id and user_id=uid;
  return true;
end;
$$;

create or replace function public.get_stang_inn_private_league_fantasy_standings_v1(p_league_id uuid,p_season text)
returns table(standings_position bigint,user_id uuid,display_name text,team_id uuid,team_name text,total_points numeric,rounds_scored bigint,round_wins bigint,best_round_points numeric,average_round_points numeric,last_round_no integer,last_round_points numeric,member_role text,joined_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.stang_inn_private_league_members m join public.stang_inn_private_leagues l on l.id=m.league_id where m.league_id=p_league_id and m.user_id=auth.uid() and l.season=p_season) then
    raise exception 'You are not a member of this private league';
  end if;

  return query
  with members as (
    select m.user_id,m.role,m.joined_at,
           coalesce(nullif(btrim(p.display_name),''),'Ukjent spiller')::text as profile_name
    from public.stang_inn_private_league_members m
    join public.stang_inn_private_leagues l on l.id=m.league_id and l.season=p_season
    left join public.players p on p.id=m.user_id and p.profile_name_confirmed_at is not null
    where m.league_id=p_league_id
  ), board as (
    select * from public.get_fantasy_competition_table_v2(p_season)
  ), combined as (
    select m.user_id,m.profile_name as display_name,b.team_id,
           coalesce(b.team_name,'Ikke opprettet lag')::text as team_name,
           coalesce(b.total_points,0)::numeric as total_points,
           coalesce(b.rounds_scored,0)::bigint as rounds_scored,
           coalesce(b.round_wins,0)::bigint as round_wins,
           coalesce(b.best_round_points,0)::numeric as best_round_points,
           coalesce(b.average_round_points,0)::numeric as average_round_points,
           b.last_round_no,b.last_round_points,m.role,m.joined_at
    from members m left join board b on b.user_id=m.user_id
  )
  select dense_rank() over(order by c.total_points desc,c.round_wins desc,c.best_round_points desc),
         c.user_id,c.display_name,c.team_id,c.team_name,c.total_points,c.rounds_scored,c.round_wins,c.best_round_points,c.average_round_points,c.last_round_no,c.last_round_points,c.role,c.joined_at
  from combined c
  order by c.total_points desc,c.round_wins desc,c.best_round_points desc,c.team_name,c.user_id;
end;
$$;

create or replace function public.get_stang_inn_private_league_tipping_standings_v1(p_league_id uuid,p_season text)
returns table(standings_position bigint,user_id uuid,display_name text,total_points bigint,exact_results bigint,correct_outcomes bigint,scored_tips bigint,member_role text,joined_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.stang_inn_private_league_members m join public.stang_inn_private_leagues l on l.id=m.league_id where m.league_id=p_league_id and m.user_id=auth.uid() and l.season=p_season) then
    raise exception 'You are not a member of this private league';
  end if;

  return query
  with members as (
    select m.user_id,m.role,m.joined_at,
           coalesce(nullif(btrim(p.display_name),''),'Hockeytipper')::text as display_name
    from public.stang_inn_private_league_members m
    join public.stang_inn_private_leagues l on l.id=m.league_id and l.season=p_season
    left join public.players p on p.id=m.user_id and p.profile_name_confirmed_at is not null
    where m.league_id=p_league_id
  ), scored as (
    select mb.user_id,mb.display_name,mb.role,mb.joined_at,
      coalesce(sum(case
        when t.id is null or not coalesce(ma.finished,false) or ma.home_score is null or ma.away_score is null then 0
        when t.points is not null then t.points
        when t.home_tip=ma.home_score and t.away_tip=ma.away_score then 5
        when (t.home_tip>t.away_tip and ma.home_score>ma.away_score)
          or (t.home_tip<t.away_tip and ma.home_score<ma.away_score)
          or (t.home_tip=t.away_tip and ma.home_score=ma.away_score) then 3
        else 0 end),0)::bigint as total_points,
      count(*) filter(where coalesce(ma.finished,false) and ma.home_score is not null and ma.away_score is not null and t.home_tip=ma.home_score and t.away_tip=ma.away_score)::bigint as exact_results,
      count(*) filter(where coalesce(ma.finished,false) and ma.home_score is not null and ma.away_score is not null and not(t.home_tip=ma.home_score and t.away_tip=ma.away_score) and ((t.home_tip>t.away_tip and ma.home_score>ma.away_score) or (t.home_tip<t.away_tip and ma.home_score<ma.away_score) or (t.home_tip=t.away_tip and ma.home_score=ma.away_score)))::bigint as correct_outcomes,
      count(*) filter(where coalesce(ma.finished,false) and ma.home_score is not null and ma.away_score is not null and t.id is not null)::bigint as scored_tips
    from members mb
    left join public.tips t on t.player_id=mb.user_id
    left join public.matches ma on ma.id=t.match_id
    group by mb.user_id,mb.display_name,mb.role,mb.joined_at
  )
  select dense_rank() over(order by s.total_points desc,s.exact_results desc,s.correct_outcomes desc,s.display_name),
         s.user_id,s.display_name,s.total_points,s.exact_results,s.correct_outcomes,s.scored_tips,s.role,s.joined_at
  from scored s
  order by s.total_points desc,s.exact_results desc,s.correct_outcomes desc,s.display_name;
end;
$$;

-- Compatibility RPCs: old product surfaces now share the canonical membership model.
create or replace function public.create_fantasy_private_league_v1(p_season text,p_name text) returns uuid language sql security definer set search_path to 'public' as $$ select public.create_stang_inn_private_league_v1(p_season,p_name) $$;
create or replace function public.join_fantasy_private_league_v1(p_season text,p_invite_code text) returns uuid language sql security definer set search_path to 'public' as $$ select public.join_stang_inn_private_league_v1(p_season,p_invite_code) $$;
create or replace function public.get_my_fantasy_private_leagues_v1(p_season text) returns table(league_id uuid,league_name text,invite_code text,my_role text,member_count integer,created_at timestamptz) language sql stable security definer set search_path to 'public' as $$ select * from public.get_my_stang_inn_private_leagues_v1(p_season) $$;
create or replace function public.get_fantasy_private_league_standings_v1(p_league_id uuid,p_season text) returns table(standings_position bigint,user_id uuid,display_name text,team_id uuid,team_name text,total_points numeric,rounds_scored bigint,round_wins bigint,best_round_points numeric,average_round_points numeric,last_round_no integer,last_round_points numeric,member_role text,joined_at timestamptz) language sql stable security definer set search_path to 'public' as $$ select * from public.get_stang_inn_private_league_fantasy_standings_v1(p_league_id,p_season) $$;
create or replace function public.create_hockeytips_private_league_v1(p_season text,p_name text) returns uuid language sql security definer set search_path to 'public' as $$ select public.create_stang_inn_private_league_v1(p_season,p_name) $$;
create or replace function public.join_hockeytips_private_league_v1(p_season text,p_invite_code text) returns uuid language sql security definer set search_path to 'public' as $$ select public.join_stang_inn_private_league_v1(p_season,p_invite_code) $$;
create or replace function public.get_my_hockeytips_private_leagues_v1(p_season text) returns table(league_id uuid,league_name text,invite_code text,my_role text,member_count integer,created_at timestamptz) language sql stable security definer set search_path to 'public' as $$ select * from public.get_my_stang_inn_private_leagues_v1(p_season) $$;
create or replace function public.get_hockeytips_private_league_standings_v1(p_league_id uuid,p_season text) returns table(standings_position bigint,user_id uuid,display_name text,total_points bigint,exact_results bigint,correct_outcomes bigint,scored_tips bigint,member_role text,joined_at timestamptz) language sql stable security definer set search_path to 'public' as $$ select * from public.get_stang_inn_private_league_tipping_standings_v1(p_league_id,p_season) $$;

-- Legacy product tables are preserved but no client may mutate them directly.
revoke all on table public.fantasy_private_leagues from anon,authenticated;
revoke all on table public.fantasy_private_league_members from anon,authenticated;
revoke all on table public.hockeytips_private_leagues from anon,authenticated;
revoke all on table public.hockeytips_private_league_members from anon,authenticated;

-- Explicit RPC surface: authenticated only, never anon/PUBLIC.
do $$
declare f regprocedure;
begin
  foreach f in array array[
    'public.create_stang_inn_private_league_v1(text,text)'::regprocedure,
    'public.join_stang_inn_private_league_v1(text,text)'::regprocedure,
    'public.get_my_stang_inn_private_leagues_v1(text)'::regprocedure,
    'public.leave_stang_inn_private_league_v1(uuid,text)'::regprocedure,
    'public.get_stang_inn_private_league_fantasy_standings_v1(uuid,text)'::regprocedure,
    'public.get_stang_inn_private_league_tipping_standings_v1(uuid,text)'::regprocedure,
    'public.create_fantasy_private_league_v1(text,text)'::regprocedure,
    'public.join_fantasy_private_league_v1(text,text)'::regprocedure,
    'public.get_my_fantasy_private_leagues_v1(text)'::regprocedure,
    'public.get_fantasy_private_league_standings_v1(uuid,text)'::regprocedure,
    'public.create_hockeytips_private_league_v1(text,text)'::regprocedure,
    'public.join_hockeytips_private_league_v1(text,text)'::regprocedure,
    'public.get_my_hockeytips_private_leagues_v1(text)'::regprocedure,
    'public.get_hockeytips_private_league_standings_v1(uuid,text)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public',f);
    execute format('revoke all on function %s from anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;

commit;
