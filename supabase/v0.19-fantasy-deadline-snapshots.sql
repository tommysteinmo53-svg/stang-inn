-- Stang Inn Fantasy Hockey – v0.19
-- Deadline-safe, immutable team snapshots for calendar fantasy rounds.
-- Key rule: before a saved team can change after a passed deadline, the old live team
-- is frozen for every due round that does not already have a snapshot.

-- Internal helper. Not granted directly to clients.
create or replace function freeze_fantasy_team_for_round_internal(
  p_team_id uuid,
  p_round_id uuid,
  p_captured_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
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
  select * into v_round from fantasy_rounds where id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;

  select * into v_team from fantasy_user_teams where id=p_team_id;
  if not found then raise exception 'Fantasy team not found'; end if;

  if v_team.season is distinct from v_round.season then
    raise exception 'Team season % does not match round season %',v_team.season,v_round.season;
  end if;

  select s.id into v_snapshot
  from fantasy_team_round_snapshots s
  where s.round_id=v_round.id and s.team_id=v_team.id;
  if v_snapshot is not null then return v_snapshot; end if;

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
    raise exception 'Cannot freeze invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g;
  end if;
  if v_captains<>1 or v_vice<>1 then
    raise exception 'Cannot freeze team without exactly one captain and one vice-captain';
  end if;

  insert into fantasy_team_round_snapshots(
    round_id,team_id,user_id,season,team_name,squad_value,captured_at
  ) values(
    v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at
  )
  on conflict(round_id,team_id) do nothing
  returning id into v_snapshot;

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

revoke all on function freeze_fantasy_team_for_round_internal(uuid,uuid,timestamptz) from public;
revoke all on function freeze_fantasy_team_for_round_internal(uuid,uuid,timestamptz) from authenticated;

-- User wrapper: freeze own live team after deadline. Replaces v0.16 implementation.
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
  v_team_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_round from fantasy_rounds where id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;
  if now()<v_round.deadline_at then
    raise exception 'Round is not locked yet. Deadline is %',v_round.deadline_at;
  end if;

  select id into v_team_id
  from fantasy_user_teams
  where user_id=v_user and season=v_round.season;
  if v_team_id is null then raise exception 'No fantasy team found for season %',v_round.season; end if;

  return freeze_fantasy_team_for_round_internal(v_team_id,p_round_id,now());
end;
$$;

revoke all on function snapshot_fantasy_team_for_round(uuid) from public;
grant execute on function snapshot_fantasy_team_for_round(uuid) to authenticated;

-- Admin/service safety net. Run before scoring and optionally on a schedule.
-- Invalid teams are counted as errors without aborting the whole batch.
create or replace function freeze_due_fantasy_rounds(
  p_season text
) returns table(
  due_rounds integer,
  teams_checked integer,
  snapshots_created integer,
  already_frozen integer,
  errors integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round record;
  v_team record;
  v_due integer := 0;
  v_checked integer := 0;
  v_created integer := 0;
  v_existing integer := 0;
  v_errors integer := 0;
  v_before uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select count(*)::integer into v_due
  from fantasy_rounds r
  where r.season=p_season and r.deadline_at<=now();

  for v_round in
    select id,deadline_at from fantasy_rounds
    where season=p_season and deadline_at<=now()
    order by deadline_at
  loop
    for v_team in
      select id from fantasy_user_teams where season=p_season
    loop
      v_checked := v_checked+1;
      select id into v_before
      from fantasy_team_round_snapshots
      where round_id=v_round.id and team_id=v_team.id;

      if v_before is not null then
        v_existing := v_existing+1;
      else
        begin
          perform freeze_fantasy_team_for_round_internal(v_team.id,v_round.id,greatest(v_round.deadline_at,now()));
          v_created := v_created+1;
        exception when others then
          v_errors := v_errors+1;
        end;
      end if;
    end loop;
  end loop;

  return query select v_due,v_checked,v_created,v_existing,v_errors;
end;
$$;

revoke all on function freeze_due_fantasy_rounds(text) from public;
grant execute on function freeze_due_fantasy_rounds(text) to authenticated;

-- Admin readiness overview. Does not create snapshots and is safe before season start.
create or replace function get_fantasy_snapshot_readiness(
  p_season text
) returns table(
  total_teams bigint,
  valid_teams bigint,
  invalid_teams bigint,
  next_round_id uuid,
  next_round_no integer,
  next_deadline timestamptz,
  snapshots_for_next_round bigint
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  return query
  with team_checks as (
    select
      t.id,
      count(tp.player_id) as player_count,
      count(tp.player_id) filter(where fp.position in ('C','W')) as f_count,
      count(tp.player_id) filter(where fp.position='D') as d_count,
      count(tp.player_id) filter(where fp.position='G') as g_count,
      count(tp.player_id) filter(where tp.is_captain) as captain_count,
      count(tp.player_id) filter(where tp.is_vice_captain) as vice_count
    from fantasy_user_teams t
    left join fantasy_user_team_players tp on tp.team_id=t.id
    left join fantasy_players fp on fp.id=tp.player_id
    where t.season=p_season
    group by t.id
  ), next_round as (
    select r.id,r.round_no,r.deadline_at
    from fantasy_rounds r
    where r.season=p_season and r.deadline_at>now()
    order by r.deadline_at
    limit 1
  )
  select
    count(tc.id)::bigint,
    count(tc.id) filter(where tc.player_count=12 and tc.f_count=6 and tc.d_count=4 and tc.g_count=2 and tc.captain_count=1 and tc.vice_count=1)::bigint,
    count(tc.id) filter(where not(tc.player_count=12 and tc.f_count=6 and tc.d_count=4 and tc.g_count=2 and tc.captain_count=1 and tc.vice_count=1))::bigint,
    nr.id,
    nr.round_no,
    nr.deadline_at,
    (select count(*)::bigint from fantasy_team_round_snapshots s where s.round_id=nr.id)
  from team_checks tc
  cross join next_round nr
  group by nr.id,nr.round_no,nr.deadline_at;
end;
$$;

revoke all on function get_fantasy_snapshot_readiness(text) from public;
grant execute on function get_fantasy_snapshot_readiness(text) to authenticated;

-- Critical deadline protection: preserve the old live roster before any post-deadline edit.
create or replace function save_fantasy_team_v3(
  p_season text,
  p_name text,
  p_player_ids uuid[],
  p_captain uuid,
  p_vice_captain uuid
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_existing_team uuid;
  v_due_round record;
  v_count integer;
  v_f integer;
  v_d integer;
  v_g integer;
  v_total numeric;
  v_distinct integer;
  v_max_club integer;
  v_club text;
  v_club_count integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;

  -- If a live team already exists, freeze its PRE-EDIT state for every passed deadline.
  select id into v_existing_team
  from fantasy_user_teams
  where user_id=v_user and season=p_season;

  if v_existing_team is not null then
    for v_due_round in
      select r.id,r.deadline_at
      from fantasy_rounds r
      where r.season=p_season
        and r.deadline_at<=now()
        and not exists(
          select 1 from fantasy_team_round_snapshots s
          where s.round_id=r.id and s.team_id=v_existing_team
        )
      order by r.deadline_at
    loop
      perform freeze_fantasy_team_for_round_internal(
        v_existing_team,v_due_round.id,greatest(v_due_round.deadline_at,now())
      );
    end loop;
  end if;

  select max_players_per_club into v_max_club
  from fantasy_season_rules where season=p_season;
  if v_max_club is null then raise exception 'Fantasy rules missing for season %',p_season; end if;

  v_count := coalesce(array_length(p_player_ids,1),0);
  if v_count<>12 then raise exception 'Team must contain exactly 12 players, got %',v_count; end if;
  select count(distinct x) into v_distinct from unnest(p_player_ids) x;
  if v_distinct<>12 then raise exception 'Duplicate players are not allowed'; end if;

  if p_captain is null or p_vice_captain is null then raise exception 'Captain and vice-captain are required'; end if;
  if p_captain=p_vice_captain then raise exception 'Captain and vice-captain must be different players'; end if;
  if not(p_captain=any(p_player_ids)) or not(p_vice_captain=any(p_player_ids)) then
    raise exception 'Captain and vice-captain must belong to the selected roster';
  end if;

  select
    count(*) filter(where fp.position in ('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G'),
    coalesce(sum(fp.price),0)
  into v_f,v_d,v_g,v_total
  from fantasy_players fp
  where fp.id=any(p_player_ids) and fp.price is not null;

  if (v_f+v_d+v_g)<>12 then raise exception 'One or more selected players are missing or have no published price'; end if;
  if v_f<>6 or v_d<>4 or v_g<>2 then
    raise exception 'Invalid roster: expected 6F/4D/2G, got %F/%D/%G',v_f,v_d,v_g;
  end if;
  if v_total>100.00 then raise exception 'Budget exceeded: %m > 100.0m',v_total; end if;

  select fp.team,count(*) into v_club,v_club_count
  from fantasy_players fp
  where fp.id=any(p_player_ids)
  group by fp.team
  having count(*)>v_max_club
  order by count(*) desc
  limit 1;
  if v_club is not null then
    raise exception 'Too many players from %: % selected, maximum is %',v_club,v_club_count,v_max_club;
  end if;

  insert into fantasy_user_teams(user_id,season,name,budget,updated_at)
  values(v_user,p_season,coalesce(nullif(trim(p_name),''),'Mitt lag'),100.00,now())
  on conflict(user_id,season) do update
    set name=excluded.name,budget=excluded.budget,updated_at=now()
  returning id into v_team;

  delete from fantasy_user_team_players where team_id=v_team;
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain)
  select v_team,fp.id,fp.price,(fp.id=p_captain),(fp.id=p_vice_captain)
  from fantasy_players fp
  where fp.id=any(p_player_ids);

  return v_team;
end;
$$;

revoke all on function save_fantasy_team_v3(text,text,uuid[],uuid,uuid) from public;
grant execute on function save_fantasy_team_v3(text,text,uuid[],uuid,uuid) to authenticated;
