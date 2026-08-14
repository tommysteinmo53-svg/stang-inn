-- Stang Inn Fantasy Hockey – v0.13
-- Captain/vice-captain and configurable per-club roster limit.

create table if not exists fantasy_season_rules (
  season text primary key,
  max_players_per_club integer not null default 3 check (max_players_per_club > 0),
  captain_multiplier numeric(4,2) not null default 2.00 check (captain_multiplier >= 1),
  vice_captain_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into fantasy_season_rules(season,max_players_per_club,captain_multiplier,vice_captain_enabled)
values('2026/27',3,2.00,true)
on conflict(season) do nothing;

alter table fantasy_user_team_players
  add column if not exists is_vice_captain boolean not null default false;

alter table fantasy_season_rules enable row level security;
drop policy if exists "Authenticated users can read fantasy season rules" on fantasy_season_rules;
create policy "Authenticated users can read fantasy season rules"
on fantasy_season_rules for select to authenticated using (true);

create or replace function save_fantasy_team_v2(
  p_season text,
  p_name text,
  p_player_ids uuid[],
  p_captain uuid,
  p_vice_captain uuid
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
  v_max_club integer;
  v_club text;
  v_club_count integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season <> '2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  select max_players_per_club into v_max_club
  from fantasy_season_rules where season=p_season;
  if v_max_club is null then raise exception 'Fantasy rules missing for season %',p_season; end if;

  v_count := coalesce(array_length(p_player_ids,1),0);
  if v_count <> 12 then raise exception 'Team must contain exactly 12 players, got %',v_count; end if;

  select count(distinct x) into v_distinct from unnest(p_player_ids) x;
  if v_distinct <> 12 then raise exception 'Duplicate players are not allowed'; end if;

  if p_captain is null or p_vice_captain is null then raise exception 'Captain and vice-captain are required'; end if;
  if p_captain = p_vice_captain then raise exception 'Captain and vice-captain must be different players'; end if;
  if not (p_captain = any(p_player_ids)) or not (p_vice_captain = any(p_player_ids)) then
    raise exception 'Captain and vice-captain must belong to the selected roster';
  end if;

  select
    count(*) filter (where fp.position='C'),
    count(*) filter (where fp.position='W'),
    count(*) filter (where fp.position='D'),
    count(*) filter (where fp.position='G'),
    coalesce(sum(fp.price),0)
  into v_c,v_w,v_d,v_g,v_total
  from fantasy_players fp
  where fp.id=any(p_player_ids) and fp.price is not null;

  if (v_c+v_w+v_d+v_g) <> 12 then raise exception 'One or more selected players are missing or have no published price'; end if;
  if v_c<>2 or v_w<>4 or v_d<>4 or v_g<>2 then
    raise exception 'Invalid roster: expected 2C/4W/4D/2G, got %C/%W/%D/%G',v_c,v_w,v_d,v_g;
  end if;
  if v_total > 100.00 then raise exception 'Budget exceeded: %m > 100.0m',v_total; end if;

  select fp.team,count(*) into v_club,v_club_count
  from fantasy_players fp
  where fp.id=any(p_player_ids)
  group by fp.team
  having count(*) > v_max_club
  order by count(*) desc
  limit 1;
  if v_club is not null then raise exception 'Too many players from %: % selected, maximum is %',v_club,v_club_count,v_max_club; end if;

  insert into fantasy_user_teams(user_id,season,name,budget,updated_at)
  values(v_user,p_season,coalesce(nullif(trim(p_name),''),'Mitt lag'),100.00,now())
  on conflict(user_id,season) do update
    set name=excluded.name,budget=excluded.budget,updated_at=now()
  returning id into v_team;

  delete from fantasy_user_team_players where team_id=v_team;
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain)
  select v_team,fp.id,fp.price,(fp.id=p_captain),(fp.id=p_vice_captain)
  from fantasy_players fp where fp.id=any(p_player_ids);

  return v_team;
end;
$$;

revoke all on function save_fantasy_team_v2(text,text,uuid[],uuid,uuid) from public;
grant execute on function save_fantasy_team_v2(text,text,uuid[],uuid,uuid) to authenticated;
