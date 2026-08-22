-- Stang Inn XI – MP-07.6D
-- Safe Rik Onkel / Fattig Onkel event-team RPCs.
-- Event teams are completely separate from the permanent 100m roster and
-- never create rows in fantasy_transfer_batches / fantasy_transfer_items.

create or replace function save_fantasy_event_team_v1(
  p_season text,
  p_event_type text,
  p_name text,
  p_player_ids uuid[],
  p_line1_player_ids uuid[],
  p_captain uuid,
  p_vice_captain uuid
) returns table(
  event_team_id uuid,
  event_type text,
  round_id uuid,
  round_no integer,
  deadline_at timestamptz,
  event_budget numeric,
  team_cost numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_permanent fantasy_user_teams%rowtype;
  v_event fantasy_event_weeks%rowtype;
  v_round fantasy_rounds%rowtype;
  v_event_team uuid;
  v_count integer;
  v_distinct integer;
  v_f integer;
  v_d integer;
  v_g integer;
  v_l1_count integer;
  v_l1_distinct integer;
  v_l1_f integer;
  v_l1_d integer;
  v_l1_g integer;
  v_cost numeric(10,2);
  v_max_club integer;
  v_bad_club text;
  v_bad_club_count integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_event_type not in ('rich_uncle','poor_uncle') then
    raise exception 'Unsupported Event Week type: %',p_event_type;
  end if;

  select * into v_permanent
  from fantasy_user_teams t
  where t.user_id=v_user and t.season=p_season
  for update;
  if not found then raise exception 'Permanent fantasy team not found for season %',p_season; end if;

  select * into v_event
  from fantasy_event_weeks ew
  where ew.season=p_season
    and ew.event_type=p_event_type
    and ew.is_published=true;
  if not found then raise exception 'Event Week % is not published for season %',p_event_type,p_season; end if;

  select * into v_round
  from fantasy_rounds r
  where r.id=v_event.round_id and r.season=p_season and r.round_no<9000;
  if not found then raise exception 'Event fantasy round not found'; end if;
  if now()>=v_round.deadline_at then
    raise exception 'Event Week deadline has passed for fantasy round %',v_round.round_no;
  end if;

  if exists(
    select 1 from fantasy_bonus_activations a
    where a.team_id=v_permanent.id
      and a.round_id=v_round.id
      and a.status in ('selected','committed','used')
  ) then
    raise exception 'Personal boosters cannot be combined with an Event Week';
  end if;

  v_count := coalesce(array_length(p_player_ids,1),0);
  if v_count<>12 then raise exception 'Event team must contain exactly 12 players, got %',v_count; end if;
  select count(distinct x) into v_distinct from unnest(p_player_ids) x;
  if v_distinct<>12 then raise exception 'Duplicate players are not allowed'; end if;

  if p_captain is null or p_vice_captain is null or p_captain=p_vice_captain then
    raise exception 'Valid captain and vice-captain are required';
  end if;
  if not(p_captain=any(p_player_ids)) or not(p_vice_captain=any(p_player_ids)) then
    raise exception 'Captain and vice-captain must belong to the event roster';
  end if;

  select
    count(*) filter(where fp.position in ('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G'),
    coalesce(sum(sp.price),0)
  into v_f,v_d,v_g,v_cost
  from fantasy_players fp
  join fantasy_player_season_prices sp
    on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids) and fp.active=true;

  if v_f+v_d+v_g<>12 then
    raise exception 'One or more selected players are missing, inactive or have no locked season price';
  end if;
  if v_f<>6 or v_d<>4 or v_g<>2 then
    raise exception 'Invalid event roster: expected 6F/4D/2G, got %F/%D/%G',v_f,v_d,v_g;
  end if;
  if v_cost>v_event.event_budget then
    raise exception 'Event budget exceeded: %m > %m',v_cost,v_event.event_budget;
  end if;

  select sr.max_players_per_club into v_max_club
  from fantasy_season_rules sr where sr.season=p_season;
  if v_max_club is null then raise exception 'Fantasy season rules missing for %',p_season; end if;

  select fp.team,count(*)::integer into v_bad_club,v_bad_club_count
  from fantasy_players fp
  where fp.id=any(p_player_ids)
  group by fp.team
  having count(*)>v_max_club
  order by count(*) desc
  limit 1;
  if v_bad_club is not null then
    raise exception 'Too many players from %: % selected, maximum is %',v_bad_club,v_bad_club_count,v_max_club;
  end if;

  v_l1_count := coalesce(array_length(p_line1_player_ids,1),0);
  if v_l1_count<>6 then raise exception 'First line must contain exactly 6 players, got %',v_l1_count; end if;
  select count(distinct x) into v_l1_distinct from unnest(p_line1_player_ids) x;
  if v_l1_distinct<>6 then raise exception 'Duplicate players are not allowed in first line'; end if;
  if exists(
    select 1 from unnest(p_line1_player_ids) x
    where not(x=any(p_player_ids))
  ) then
    raise exception 'All first-line players must belong to the event roster';
  end if;

  select
    count(*) filter(where fp.position in ('C','W')),
    count(*) filter(where fp.position='D'),
    count(*) filter(where fp.position='G')
  into v_l1_f,v_l1_d,v_l1_g
  from fantasy_players fp
  where fp.id=any(p_line1_player_ids);
  if v_l1_f<>3 or v_l1_d<>2 or v_l1_g<>1 then
    raise exception 'First line must be 3F/2D/1G, got %F/%D/%G',v_l1_f,v_l1_d,v_l1_g;
  end if;

  insert into fantasy_event_teams(
    event_week_id,permanent_team_id,user_id,season,name,budget,updated_at
  ) values(
    v_event.id,v_permanent.id,v_user,p_season,
    coalesce(nullif(trim(p_name),''),case when p_event_type='rich_uncle' then 'Rik Onkel-lag' else 'Fattig Onkel-lag' end),
    v_event.event_budget,now()
  )
  on conflict(event_week_id,permanent_team_id) do update set
    name=excluded.name,
    budget=excluded.budget,
    updated_at=now()
  returning id into v_event_team;

  -- Replace only the temporary event roster. Permanent fantasy_user_team_players
  -- and transfer ledgers are intentionally untouched.
  delete from fantasy_event_team_players where event_team_id=v_event_team;

  insert into fantasy_event_team_players(
    event_team_id,player_id,purchase_price,line_no,is_captain,is_vice_captain
  )
  select
    v_event_team,
    fp.id,
    sp.price,
    case when fp.id=any(p_line1_player_ids) then 1 else 2 end,
    fp.id=p_captain,
    fp.id=p_vice_captain
  from fantasy_players fp
  join fantasy_player_season_prices sp
    on sp.player_id=fp.id and sp.season=p_season
  where fp.id=any(p_player_ids);

  return query
  select v_event_team,p_event_type,v_round.id,v_round.round_no,v_round.deadline_at,
         v_event.event_budget::numeric,v_cost::numeric;
end;
$$;

revoke all on function save_fantasy_event_team_v1(text,text,text,uuid[],uuid[],uuid,uuid) from public;
grant execute on function save_fantasy_event_team_v1(text,text,text,uuid[],uuid[],uuid,uuid) to authenticated;


create or replace function get_my_fantasy_event_week_v1(
  p_season text,
  p_event_type text
) returns table(
  event_week_id uuid,
  event_type text,
  event_budget numeric,
  round_id uuid,
  round_no integer,
  round_name text,
  deadline_at timestamptz,
  is_open boolean,
  event_team_id uuid,
  event_team_name text,
  team_cost numeric,
  player_id uuid,
  player_name text,
  player_position text,
  player_team text,
  price numeric,
  line_no smallint,
  is_captain boolean,
  is_vice_captain boolean
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_event_type not in ('rich_uncle','poor_uncle') then
    raise exception 'Unsupported Event Week type: %',p_event_type;
  end if;

  return query
  with event_data as (
    select ew.id,ew.event_type,ew.event_budget,r.id as round_id,r.round_no,r.name,r.deadline_at
    from fantasy_event_weeks ew
    join fantasy_rounds r on r.id=ew.round_id
    where ew.season=p_season
      and ew.event_type=p_event_type
      and ew.is_published=true
      and r.season=p_season
      and r.round_no<9000
  ), my_team as (
    select t.id
    from fantasy_user_teams t
    where t.user_id=v_user and t.season=p_season
  ), my_event_team as (
    select et.*
    from fantasy_event_teams et
    join event_data ed on ed.id=et.event_week_id
    join my_team mt on mt.id=et.permanent_team_id
    where et.user_id=v_user and et.season=p_season
  ), event_cost as (
    select etp.event_team_id,coalesce(sum(etp.purchase_price),0)::numeric as cost
    from fantasy_event_team_players etp
    join my_event_team met on met.id=etp.event_team_id
    group by etp.event_team_id
  )
  select
    ed.id,
    ed.event_type,
    ed.event_budget::numeric,
    ed.round_id,
    ed.round_no,
    ed.name,
    ed.deadline_at,
    (now()<ed.deadline_at),
    met.id,
    met.name,
    coalesce(ec.cost,0)::numeric,
    etp.player_id,
    fp.name,
    fp.position,
    fp.team,
    etp.purchase_price::numeric,
    etp.line_no,
    etp.is_captain,
    etp.is_vice_captain
  from event_data ed
  left join my_event_team met on true
  left join event_cost ec on ec.event_team_id=met.id
  left join fantasy_event_team_players etp on etp.event_team_id=met.id
  left join fantasy_players fp on fp.id=etp.player_id
  order by etp.line_no nulls last,
    case when fp.position='G' then 0 when fp.position='D' then 1 else 2 end,
    fp.name;
end;
$$;

revoke all on function get_my_fantasy_event_week_v1(text,text) from public;
grant execute on function get_my_fantasy_event_week_v1(text,text) to authenticated;


-- Admin-only configuration helper. Event rounds are deliberately configured
-- explicitly rather than inferred from month/date, so the chosen round remains
-- a conscious product decision and is auditable.
create or replace function configure_fantasy_event_week_v1(
  p_season text,
  p_event_type text,
  p_round_id uuid,
  p_publish boolean default false
) returns table(
  event_week_id uuid,
  event_type text,
  event_budget numeric,
  round_id uuid,
  round_no integer,
  deadline_at timestamptz,
  is_published boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round fantasy_rounds%rowtype;
  v_budget numeric(10,2);
  v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;
  if p_event_type not in ('rich_uncle','poor_uncle') then
    raise exception 'Unsupported Event Week type: %',p_event_type;
  end if;

  select * into v_round
  from fantasy_rounds r
  where r.id=p_round_id and r.season=p_season and r.round_no<9000;
  if not found then raise exception 'Fantasy round not found for season %',p_season; end if;
  if now()>=v_round.deadline_at then raise exception 'Cannot configure an Event Week after round deadline'; end if;

  v_budget := case when p_event_type='rich_uncle' then 200.00 else 70.00 end;

  -- Never move an event after users have started building an event team.
  if exists(
    select 1
    from fantasy_event_weeks ew
    join fantasy_event_teams et on et.event_week_id=ew.id
    where ew.season=p_season and ew.event_type=p_event_type
  ) then
    if exists(
      select 1 from fantasy_event_weeks ew
      where ew.season=p_season and ew.event_type=p_event_type and ew.round_id<>p_round_id
    ) then
      raise exception 'Event Week cannot be moved after event teams exist';
    end if;
  end if;

  if exists(
    select 1 from fantasy_bonus_activations a
    join fantasy_user_teams t on t.id=a.team_id
    where t.season=p_season
      and a.round_id=p_round_id
      and a.status in ('selected','committed','used')
  ) then
    raise exception 'Cannot configure Event Week on a round that already has personal booster selections';
  end if;

  insert into fantasy_event_weeks(season,round_id,event_type,event_budget,is_published,updated_at)
  values(p_season,p_round_id,p_event_type,v_budget,p_publish,now())
  on conflict(season,event_type) do update set
    round_id=excluded.round_id,
    event_budget=excluded.event_budget,
    is_published=excluded.is_published,
    updated_at=now()
  returning id into v_id;

  return query
  select v_id,p_event_type,v_budget::numeric,v_round.id,v_round.round_no,v_round.deadline_at,p_publish;
end;
$$;

revoke all on function configure_fantasy_event_week_v1(text,text,uuid,boolean) from public;
grant execute on function configure_fantasy_event_week_v1(text,text,uuid,boolean) to authenticated;

comment on function save_fantasy_event_team_v1(text,text,text,uuid[],uuid[],uuid,uuid) is
  'MP-07.6D: saves a validated 200m/70m temporary Event Week team without touching permanent roster or transfer history.';
comment on function get_my_fantasy_event_week_v1(text,text) is
  'MP-07.6D: user read model for published Rik/Fattig Onkel round, event budget and optional temporary roster.';
comment on function configure_fantasy_event_week_v1(text,text,uuid,boolean) is
  'MP-07.6D: admin-only explicit assignment/publishing of Rik/Fattig Onkel to an open authoritative fantasy round.';
