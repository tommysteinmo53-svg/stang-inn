-- Stang Inn Fantasy Hockey – v0.17
-- Build fantasy rounds from fantasy_games.round_no.
-- Deadline = first game start in the round.
-- Safe to rerun; existing rounds are updated, games are relinked.
-- Locked history is protected: if snapshots already exist, deadline cannot move.

create or replace function sync_fantasy_rounds_from_games(
  p_season text
)
returns table(
  rounds_upserted integer,
  games_linked integer,
  first_round integer,
  last_round integer
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round record;
  v_existing fantasy_rounds%rowtype;
  v_rounds integer := 0;
  v_games integer := 0;
  v_first integer;
  v_last integer;
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

  if not exists (
    select 1 from fantasy_games g
    where g.season=p_season and g.round_no is not null
  ) then
    raise exception 'No fantasy games with round numbers found for season %',p_season;
  end if;

  select min(round_no),max(round_no)
  into v_first,v_last
  from fantasy_games
  where season=p_season and round_no is not null;

  for v_round in
    select
      g.round_no,
      min(g.starts_at) as starts_at,
      min(g.starts_at) as deadline_at,
      max(g.starts_at) + interval '1 day' as ends_at
    from fantasy_games g
    where g.season=p_season
      and g.round_no is not null
    group by g.round_no
    order by g.round_no
  loop
    select * into v_existing
    from fantasy_rounds
    where season=p_season and round_no=v_round.round_no;

    if found and exists(
      select 1 from fantasy_team_round_snapshots s
      where s.round_id=v_existing.id
    ) and v_existing.deadline_at is distinct from v_round.deadline_at then
      raise exception
        'Cannot move deadline for round %: snapshots already exist (old %, new %)',
        v_round.round_no,v_existing.deadline_at,v_round.deadline_at;
    end if;

    insert into fantasy_rounds(
      season,round_no,name,starts_at,deadline_at,ends_at,status,updated_at
    ) values(
      p_season,
      v_round.round_no,
      'Runde '||v_round.round_no,
      v_round.starts_at,
      v_round.deadline_at,
      v_round.ends_at,
      case
        when now() < v_round.deadline_at then 'open'
        when now() < v_round.ends_at then 'locked'
        else 'finished'
      end,
      now()
    )
    on conflict(season,round_no) do update set
      name=excluded.name,
      starts_at=excluded.starts_at,
      deadline_at=excluded.deadline_at,
      ends_at=excluded.ends_at,
      status=case
        when fantasy_rounds.status='finished' then 'finished'
        else excluded.status
      end,
      updated_at=now();

    v_rounds := v_rounds + 1;
  end loop;

  update fantasy_games g
  set fantasy_round_id=r.id,
      updated_at=now()
  from fantasy_rounds r
  where g.season=p_season
    and g.round_no is not null
    and r.season=g.season
    and r.round_no=g.round_no
    and g.fantasy_round_id is distinct from r.id;

  get diagnostics v_games = row_count;

  return query select v_rounds,v_games,v_first,v_last;
end;
$$;

revoke all on function sync_fantasy_rounds_from_games(text) from public;
grant execute on function sync_fantasy_rounds_from_games(text) to authenticated;

create or replace function refresh_fantasy_round_statuses(p_season text)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  update fantasy_rounds
  set status=case
      when now() < deadline_at then 'open'
      when ends_at is null or now() < ends_at then 'locked'
      else 'finished'
    end,
    updated_at=now()
  where season=p_season;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function refresh_fantasy_round_statuses(text) from public;
grant execute on function refresh_fantasy_round_statuses(text) to authenticated;
