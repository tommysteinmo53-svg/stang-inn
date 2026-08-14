-- Stang Inn Fantasy Hockey – v0.18
-- Separate official EHL round_no from calendar-based fantasy rounds.
-- Official fantasy_games.round_no remains untouched.
-- fantasy_round_no is assigned by actual game date to the nearest round anchor.
-- Each anchor is the median actual start time of the games in an official EHL round.
-- Postponed/advanced games therefore move to the fantasy round where they are actually played.

alter table fantasy_games
  add column if not exists fantasy_round_no integer;

create index if not exists fantasy_games_season_fantasy_round_no_idx
  on fantasy_games(season, fantasy_round_no);

create or replace function sync_fantasy_calendar_rounds_from_games(
  p_season text
)
returns table(
  rounds_upserted integer,
  games_assigned integer,
  min_games_per_round integer,
  max_games_per_round integer,
  empty_rounds integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_anchor record;
  v_rounds integer := 0;
  v_games integer := 0;
  v_min integer := 0;
  v_max integer := 0;
  v_empty integer := 0;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from players p
    where p.id=v_user and coalesce(p.admin,false)=true
  ) then
    raise exception 'Admin access required';
  end if;

  if exists (
    select 1
    from fantasy_team_round_snapshots s
    join fantasy_rounds r on r.id=s.round_id
    where r.season=p_season
  ) then
    raise exception 'Cannot rebuild fantasy calendar rounds for % after snapshots exist',p_season;
  end if;

  if (select count(*) from fantasy_games where season=p_season) = 0 then
    raise exception 'No fantasy games found for season %',p_season;
  end if;

  if exists (
    select 1 from fantasy_games
    where season=p_season and (round_no is null or starts_at is null)
  ) then
    raise exception 'All games must have official round_no and starts_at before calendar round sync';
  end if;

  drop table if exists _fantasy_round_anchors;

  -- One robust calendar anchor per official EHL round: median actual game start.
  create temporary table _fantasy_round_anchors on commit drop as
  with ranked as (
    select
      round_no,
      starts_at,
      row_number() over(partition by round_no order by starts_at) as rn,
      count(*) over(partition by round_no) as cnt
    from fantasy_games
    where season=p_season
  ), medians as (
    select
      round_no,
      avg(extract(epoch from starts_at)) filter (
        where rn in ((cnt+1)/2, (cnt+2)/2)
      ) as median_epoch
    from ranked
    group by round_no
  )
  select
    row_number() over(order by median_epoch, round_no)::integer as fantasy_round_no,
    round_no as source_round_no,
    to_timestamp(median_epoch) as anchor_at
  from medians
  order by median_epoch, round_no;

  if (select count(*) from _fantasy_round_anchors) = 0 then
    raise exception 'Could not derive fantasy round anchors';
  end if;

  -- Place every game in the nearest calendar anchor by actual start time.
  -- Ties go to the earlier anchor, making repeated syncs deterministic.
  update fantasy_games g
  set fantasy_round_no = (
        select a.fantasy_round_no
        from _fantasy_round_anchors a
        order by abs(extract(epoch from (g.starts_at-a.anchor_at))), a.anchor_at
        limit 1
      ),
      updated_at = now()
  where g.season=p_season;

  get diagnostics v_games = row_count;

  -- Rebuild fantasy_rounds from fantasy_round_no. Official g.round_no is untouched.
  for v_anchor in
    select
      g.fantasy_round_no,
      min(g.starts_at) as starts_at,
      min(g.starts_at) as deadline_at,
      max(g.starts_at) + interval '6 hours' as ends_at,
      count(*)::integer as game_count
    from fantasy_games g
    where g.season=p_season
      and g.fantasy_round_no is not null
    group by g.fantasy_round_no
    order by g.fantasy_round_no
  loop
    insert into fantasy_rounds(
      season,round_no,name,starts_at,deadline_at,ends_at,status,updated_at
    ) values(
      p_season,
      v_anchor.fantasy_round_no,
      'Fantasy-runde '||v_anchor.fantasy_round_no,
      v_anchor.starts_at,
      v_anchor.deadline_at,
      v_anchor.ends_at,
      case
        when now() < v_anchor.deadline_at then 'open'
        when now() < v_anchor.ends_at then 'locked'
        else 'finished'
      end,
      now()
    )
    on conflict(season,round_no) do update set
      name=excluded.name,
      starts_at=excluded.starts_at,
      deadline_at=excluded.deadline_at,
      ends_at=excluded.ends_at,
      status=excluded.status,
      updated_at=now();

    v_rounds := v_rounds + 1;
  end loop;

  delete from fantasy_rounds r
  where r.season=p_season
    and not exists (
      select 1 from fantasy_games g
      where g.season=p_season
        and g.fantasy_round_no=r.round_no
    );

  -- fantasy_round_id now points to the calendar fantasy round.
  update fantasy_games g
  set fantasy_round_id=r.id,
      updated_at=now()
  from fantasy_rounds r
  where g.season=p_season
    and r.season=g.season
    and r.round_no=g.fantasy_round_no
    and g.fantasy_round_id is distinct from r.id;

  select coalesce(min(c),0),coalesce(max(c),0)
  into v_min,v_max
  from (
    select count(*)::integer c
    from fantasy_games
    where season=p_season and fantasy_round_no is not null
    group by fantasy_round_no
  ) q;

  select count(*)::integer into v_empty
  from _fantasy_round_anchors a
  where not exists (
    select 1 from fantasy_games g
    where g.season=p_season and g.fantasy_round_no=a.fantasy_round_no
  );

  return query select v_rounds,v_games,v_min,v_max,v_empty;
end;
$$;

revoke all on function sync_fantasy_calendar_rounds_from_games(text) from public;
grant execute on function sync_fantasy_calendar_rounds_from_games(text) to authenticated;

-- Admin overview: fantasy round size, number of clubs involved and how many
-- official EHL rounds contribute games to the calendar round.
drop function if exists get_fantasy_round_admin_overview(text);
create function get_fantasy_round_admin_overview(
  p_season text
)
returns table(
  round_id uuid,
  round_no integer,
  round_name text,
  starts_at timestamptz,
  deadline_at timestamptz,
  ends_at timestamptz,
  status text,
  game_count bigint,
  snapshot_count bigint,
  official_round_count bigint,
  team_count bigint
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
  select
    r.id,
    r.round_no,
    r.name,
    r.starts_at,
    r.deadline_at,
    r.ends_at,
    r.status,
    count(distinct g.id)::bigint,
    count(distinct s.id)::bigint,
    count(distinct g.round_no)::bigint,
    count(distinct teams.team_name)::bigint
  from fantasy_rounds r
  left join fantasy_games g on g.fantasy_round_id=r.id
  left join lateral (
    select g.home_team as team_name
    union
    select g.away_team as team_name
  ) teams on true
  left join fantasy_team_round_snapshots s on s.round_id=r.id
  where r.season=p_season
  group by r.id,r.round_no,r.name,r.starts_at,r.deadline_at,r.ends_at,r.status
  order by r.round_no;
end;
$$;

revoke all on function get_fantasy_round_admin_overview(text) from public;
grant execute on function get_fantasy_round_admin_overview(text) to authenticated;
