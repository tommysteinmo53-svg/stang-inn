-- Stang Inn Fantasy Hockey – v0.21.1
-- Repair/complete v0.21 after PostgreSQL rejected `position` as an OUT parameter name.
-- Safe to run whether v0.21 was rolled back, partially applied, or fully applied.

create table if not exists fantasy_team_round_points (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references fantasy_team_round_snapshots(id) on delete cascade,
  round_id uuid not null references fantasy_rounds(id) on delete cascade,
  team_id uuid not null references fantasy_user_teams(id) on delete cascade,
  user_id uuid not null,
  season text not null,
  base_points numeric(12,2) not null default 0,
  captain_bonus numeric(12,2) not null default 0,
  vice_captain_bonus numeric(12,2) not null default 0,
  total_points numeric(12,2) not null default 0,
  calculation_version text not null default 'team-v1',
  calculated_at timestamptz not null default now(),
  unique(snapshot_id)
);

create table if not exists fantasy_team_round_player_points (
  id uuid primary key default gen_random_uuid(),
  team_round_points_id uuid not null references fantasy_team_round_points(id) on delete cascade,
  snapshot_id uuid not null references fantasy_team_round_snapshots(id) on delete cascade,
  round_id uuid not null references fantasy_rounds(id) on delete cascade,
  team_id uuid not null references fantasy_user_teams(id) on delete cascade,
  player_id uuid not null references fantasy_players(id) on delete restrict,
  player_name text not null,
  position text not null,
  team text not null,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  played boolean not null default false,
  games_played integer not null default 0,
  raw_points numeric(12,2) not null default 0,
  multiplier numeric(5,2) not null default 1.00,
  bonus_points numeric(12,2) not null default 0,
  total_points numeric(12,2) not null default 0,
  calculated_at timestamptz not null default now(),
  unique(snapshot_id,player_id)
);

create index if not exists fantasy_team_round_points_round_idx
  on fantasy_team_round_points(round_id,total_points desc);
create index if not exists fantasy_team_round_points_user_idx
  on fantasy_team_round_points(user_id,season,round_id);
create index if not exists fantasy_team_round_player_points_result_idx
  on fantasy_team_round_player_points(team_round_points_id,total_points desc);

alter table fantasy_team_round_points enable row level security;
alter table fantasy_team_round_player_points enable row level security;

drop policy if exists "Users can read own fantasy round points" on fantasy_team_round_points;
create policy "Users can read own fantasy round points"
on fantasy_team_round_points for select to authenticated
using (user_id=auth.uid());

drop policy if exists "Users can read own fantasy round player points" on fantasy_team_round_player_points;
create policy "Users can read own fantasy round player points"
on fantasy_team_round_player_points for select to authenticated
using (
  exists (
    select 1 from fantasy_team_round_points trp
    where trp.id=team_round_points_id and trp.user_id=auth.uid()
  )
);

create or replace function calculate_fantasy_round_team_points(
  p_round_id uuid
) returns table(
  snapshots_scored integer,
  player_rows integer,
  total_points numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_round fantasy_rounds%rowtype;
  v_snapshot record;
  v_sp record;
  v_team_points_id uuid;
  v_multiplier numeric(5,2) := 2.00;
  v_vice_enabled boolean := true;
  v_captain_played boolean;
  v_raw numeric(12,2);
  v_games integer;
  v_played boolean;
  v_effective_multiplier numeric(5,2);
  v_bonus numeric(12,2);
  v_total numeric(12,2);
  v_base numeric(12,2);
  v_cap_bonus numeric(12,2);
  v_vice_bonus numeric(12,2);
  v_snapshots integer := 0;
  v_players integer := 0;
  v_grand numeric(14,2) := 0;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;

  select * into v_round from fantasy_rounds r where r.id=p_round_id;
  if not found then raise exception 'Fantasy round not found'; end if;

  select coalesce(sr.captain_multiplier,2.00),coalesce(sr.vice_captain_enabled,true)
  into v_multiplier,v_vice_enabled
  from fantasy_season_rules sr
  where sr.season=v_round.season;
  if not found then v_multiplier:=2.00; v_vice_enabled:=true; end if;

  for v_snapshot in
    select s.* from fantasy_team_round_snapshots s
    where s.round_id=v_round.id
    order by s.captured_at,s.id
  loop
    select exists(
      select 1
      from fantasy_team_round_snapshot_players sp
      join fantasy_player_game_stats pgs on pgs.player_id=sp.player_id
      join fantasy_games g on g.id=pgs.game_id and g.fantasy_round_id=v_round.id
      where sp.snapshot_id=v_snapshot.id and sp.is_captain
    ) into v_captain_played;

    insert into fantasy_team_round_points(
      snapshot_id,round_id,team_id,user_id,season,
      base_points,captain_bonus,vice_captain_bonus,total_points,
      calculation_version,calculated_at
    ) values(
      v_snapshot.id,v_round.id,v_snapshot.team_id,v_snapshot.user_id,v_round.season,
      0,0,0,0,'team-v1',now()
    )
    on conflict(snapshot_id) do update set
      base_points=0,captain_bonus=0,vice_captain_bonus=0,total_points=0,
      calculation_version='team-v1',calculated_at=now()
    returning id into v_team_points_id;

    delete from fantasy_team_round_player_points
    where team_round_points_id=v_team_points_id;

    v_base:=0; v_cap_bonus:=0; v_vice_bonus:=0; v_total:=0;

    for v_sp in
      select sp.*,fp.name as player_name
      from fantasy_team_round_snapshot_players sp
      join fantasy_players fp on fp.id=sp.player_id
      where sp.snapshot_id=v_snapshot.id
      order by sp.position,fp.name
    loop
      with latest_points as (
        select distinct on(fpp.player_id,fpp.game_id)
          fpp.player_id,fpp.game_id,fpp.actual_points
        from fantasy_player_points fpp
        join fantasy_games g on g.id=fpp.game_id
        where fpp.player_id=v_sp.player_id and g.fantasy_round_id=v_round.id
        order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
      )
      select coalesce(sum(lp.actual_points),0)::numeric
      into v_raw
      from latest_points lp;

      select count(*)::integer
      into v_games
      from fantasy_player_game_stats pgs
      join fantasy_games g on g.id=pgs.game_id
      where pgs.player_id=v_sp.player_id and g.fantasy_round_id=v_round.id;

      v_played := v_games>0;
      v_effective_multiplier:=1.00;
      if v_sp.is_captain and v_captain_played then
        v_effective_multiplier:=v_multiplier;
      elsif v_sp.is_vice_captain and v_vice_enabled and not v_captain_played and v_played then
        v_effective_multiplier:=v_multiplier;
      end if;

      v_bonus:=round(v_raw*(v_effective_multiplier-1.00),2);

      insert into fantasy_team_round_player_points(
        team_round_points_id,snapshot_id,round_id,team_id,
        player_id,player_name,position,team,
        is_captain,is_vice_captain,played,games_played,
        raw_points,multiplier,bonus_points,total_points,calculated_at
      ) values(
        v_team_points_id,v_snapshot.id,v_round.id,v_snapshot.team_id,
        v_sp.player_id,v_sp.player_name,v_sp.position,v_sp.team,
        v_sp.is_captain,v_sp.is_vice_captain,v_played,v_games,
        v_raw,v_effective_multiplier,v_bonus,v_raw+v_bonus,now()
      );

      v_base:=v_base+v_raw;
      v_total:=v_total+v_raw+v_bonus;
      if v_sp.is_captain and v_effective_multiplier>1 then
        v_cap_bonus:=v_cap_bonus+v_bonus;
      elsif v_sp.is_vice_captain and v_effective_multiplier>1 then
        v_vice_bonus:=v_vice_bonus+v_bonus;
      end if;
      v_players:=v_players+1;
    end loop;

    update fantasy_team_round_points
    set base_points=v_base,captain_bonus=v_cap_bonus,vice_captain_bonus=v_vice_bonus,
        total_points=v_total,calculated_at=now()
    where id=v_team_points_id;

    v_snapshots:=v_snapshots+1;
    v_grand:=v_grand+v_total;
  end loop;

  return query select v_snapshots,v_players,v_grand;
end;
$$;

revoke all on function calculate_fantasy_round_team_points(uuid) from public;
grant execute on function calculate_fantasy_round_team_points(uuid) to authenticated;

create or replace function get_fantasy_round_team_points_admin(
  p_round_id uuid
) returns table(
  team_round_points_id uuid,
  snapshot_id uuid,
  team_id uuid,
  user_id uuid,
  team_name text,
  base_points numeric,
  captain_bonus numeric,
  vice_captain_bonus numeric,
  total_points numeric,
  player_rows bigint,
  calculated_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;
  return query
  select trp.id,trp.snapshot_id,trp.team_id,trp.user_id,s.team_name,
         trp.base_points,trp.captain_bonus,trp.vice_captain_bonus,trp.total_points,
         count(prp.id)::bigint,trp.calculated_at
  from fantasy_team_round_points trp
  join fantasy_team_round_snapshots s on s.id=trp.snapshot_id
  left join fantasy_team_round_player_points prp on prp.team_round_points_id=trp.id
  where trp.round_id=p_round_id
  group by trp.id,s.team_name
  order by trp.total_points desc,s.team_name;
end;
$$;

revoke all on function get_fantasy_round_team_points_admin(uuid) from public;
grant execute on function get_fantasy_round_team_points_admin(uuid) to authenticated;

-- player_position deliberately avoids PostgreSQL's POSITION keyword in OUT parameters.
drop function if exists get_fantasy_team_round_player_breakdown_admin(uuid);
create function get_fantasy_team_round_player_breakdown_admin(
  p_team_round_points_id uuid
) returns table(
  player_id uuid,
  player_name text,
  player_position text,
  team text,
  is_captain boolean,
  is_vice_captain boolean,
  played boolean,
  games_played integer,
  raw_points numeric,
  multiplier numeric,
  bonus_points numeric,
  total_points numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then
    raise exception 'Admin access required';
  end if;
  return query
  select prp.player_id,prp.player_name,prp.position,prp.team,
         prp.is_captain,prp.is_vice_captain,prp.played,prp.games_played,
         prp.raw_points,prp.multiplier,prp.bonus_points,prp.total_points
  from fantasy_team_round_player_points prp
  where prp.team_round_points_id=p_team_round_points_id
  order by prp.total_points desc,prp.player_name;
end;
$$;

revoke all on function get_fantasy_team_round_player_breakdown_admin(uuid) from public;
grant execute on function get_fantasy_team_round_player_breakdown_admin(uuid) to authenticated;
