-- Stang Inn – v0.34
-- Private leagues for Hockeytipset 2026/27.
-- Kept separate from Fantasy league scoring, while using the same players/auth identities.

create table if not exists hockeytips_private_leagues (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hockeytips_private_league_members (
  league_id uuid not null references hockeytips_private_leagues(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id)
);

create index if not exists hockeytips_private_leagues_season_idx on hockeytips_private_leagues(season,created_at desc);
create index if not exists hockeytips_private_league_members_user_idx on hockeytips_private_league_members(user_id,joined_at desc);

alter table hockeytips_private_leagues enable row level security;
alter table hockeytips_private_league_members enable row level security;

create or replace function create_hockeytips_private_league_v1(p_season text,p_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_name text:=btrim(coalesce(p_name,''));
  v_code text;
  v_league uuid;
  v_try integer:=0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported Hockeytips season: %',p_season; end if;
  if char_length(v_name)<2 or char_length(v_name)>60 then raise exception 'League name must be 2–60 characters'; end if;
  if not exists(select 1 from players where id=v_user) then raise exception 'Hockeytips player profile not found'; end if;

  loop
    v_try:=v_try+1;
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    begin
      insert into hockeytips_private_leagues(season,name,invite_code,created_by)
      values(p_season,v_name,v_code,v_user) returning id into v_league;
      exit;
    exception when unique_violation then
      if v_try>=10 then raise exception 'Could not generate unique invite code'; end if;
    end;
  end loop;

  insert into hockeytips_private_league_members(league_id,user_id,role) values(v_league,v_user,'owner');
  return v_league;
end; $$;

revoke all on function create_hockeytips_private_league_v1(text,text) from public;
grant execute on function create_hockeytips_private_league_v1(text,text) to authenticated;

create or replace function join_hockeytips_private_league_v1(p_season text,p_invite_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid();
  v_code text:=upper(regexp_replace(coalesce(p_invite_code,''),'[^A-Za-z0-9]','','g'));
  v_league uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported Hockeytips season: %',p_season; end if;
  if char_length(v_code)<>8 then raise exception 'Invite code must contain 8 characters'; end if;
  if not exists(select 1 from players where id=v_user) then raise exception 'Hockeytips player profile not found'; end if;
  select id into v_league from hockeytips_private_leagues where season=p_season and invite_code=v_code;
  if v_league is null then raise exception 'Private league not found'; end if;
  insert into hockeytips_private_league_members(league_id,user_id,role) values(v_league,v_user,'member') on conflict(league_id,user_id) do nothing;
  return v_league;
end; $$;

revoke all on function join_hockeytips_private_league_v1(text,text) from public;
grant execute on function join_hockeytips_private_league_v1(text,text) to authenticated;

create or replace function get_my_hockeytips_private_leagues_v1(p_season text)
returns table(league_id uuid,league_name text,invite_code text,my_role text,member_count integer,created_at timestamptz)
language sql security definer set search_path=public as $$
  select l.id,l.name,l.invite_code,mine.role,count(allm.user_id)::integer,l.created_at
  from hockeytips_private_league_members mine
  join hockeytips_private_leagues l on l.id=mine.league_id
  join hockeytips_private_league_members allm on allm.league_id=l.id
  where mine.user_id=auth.uid() and l.season=p_season
  group by l.id,l.name,l.invite_code,mine.role,l.created_at
  order by l.created_at desc,l.name;
$$;

revoke all on function get_my_hockeytips_private_leagues_v1(text) from public;
grant execute on function get_my_hockeytips_private_leagues_v1(text) to authenticated;

create or replace function get_hockeytips_private_league_standings_v1(p_league_id uuid,p_season text)
returns table(standings_position bigint,user_id uuid,display_name text,total_points bigint,exact_results bigint,correct_outcomes bigint,scored_tips bigint,member_role text,joined_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(
    select 1 from hockeytips_private_league_members m
    join hockeytips_private_leagues l on l.id=m.league_id
    where m.league_id=p_league_id and m.user_id=auth.uid() and l.season=p_season
  ) then raise exception 'You are not a member of this private league'; end if;

  return query
  with members as (
    select m.user_id,m.role,m.joined_at,coalesce(p.display_name,'Hockeytipper') as display_name
    from hockeytips_private_league_members m
    join hockeytips_private_leagues l on l.id=m.league_id and l.season=p_season
    left join players p on p.id=m.user_id
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
    left join tips t on t.player_id=mb.user_id
    left join matches ma on ma.id=t.match_id
    group by mb.user_id,mb.display_name,mb.role,mb.joined_at
  )
  select dense_rank() over(order by s.total_points desc,s.exact_results desc,s.correct_outcomes desc,s.display_name),s.user_id,s.display_name,s.total_points,s.exact_results,s.correct_outcomes,s.scored_tips,s.role,s.joined_at
  from scored s
  order by s.total_points desc,s.exact_results desc,s.correct_outcomes desc,s.display_name;
end; $$;

revoke all on function get_hockeytips_private_league_standings_v1(uuid,text) from public;
grant execute on function get_hockeytips_private_league_standings_v1(uuid,text) to authenticated;

comment on table hockeytips_private_leagues is 'Hockeytips-only private leagues; deliberately separate from Fantasy scoring.';
comment on table hockeytips_private_league_members is 'Hockeytips league membership using the shared Stang Inn user identity.';
