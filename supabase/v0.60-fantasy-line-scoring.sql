-- v0.60 · Authoritative fantasy line scoring
-- Rekke 1 = 100 %, rekke 2 = 50 %. Captain/vice multipliers apply after line weighting.

alter table public.fantasy_team_round_snapshot_players
  add column if not exists line_no smallint not null default 1;

alter table public.fantasy_team_round_player_points
  add column if not exists line_no smallint not null default 1,
  add column if not exists line_multiplier numeric(4,2) not null default 1.00;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='fantasy_snapshot_players_line_no_check') then
    alter table public.fantasy_team_round_snapshot_players add constraint fantasy_snapshot_players_line_no_check check (line_no in (1,2));
  end if;
  if not exists (select 1 from pg_constraint where conname='fantasy_team_round_player_points_line_no_check') then
    alter table public.fantasy_team_round_player_points add constraint fantasy_team_round_player_points_line_no_check check (line_no in (1,2));
  end if;
end $$;

create or replace function public.fantasy_line_multiplier(p_line_no smallint)
returns numeric language sql immutable as $$
  select case when p_line_no=2 then 0.50::numeric else 1.00::numeric end;
$$;
comment on function public.fantasy_line_multiplier(smallint) is 'Authoritative 2026/27 line scoring: line 1 = 100%, line 2 = 50%.';

create or replace function public.save_fantasy_team_v3(p_season text,p_name text,p_player_ids uuid[],p_captain uuid,p_vice_captain uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_user uuid:=auth.uid(); v_team uuid; v_f integer; v_d integer; v_g integer; v_total numeric;
  v_max_club integer; v_club text; v_club_count integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_season<>'2026/27' then raise exception 'Unsupported fantasy season: %',p_season; end if;
  if coalesce(array_length(p_player_ids,1),0)<>12 then raise exception 'Team must contain exactly 12 players'; end if;
  if (select count(distinct x) from unnest(p_player_ids)x)<>12 then raise exception 'Duplicate players are not allowed'; end if;
  if p_captain is null or p_vice_captain is null or p_captain=p_vice_captain then raise exception 'Valid captain and vice-captain are required'; end if;
  if not(p_captain=any(p_player_ids)) or not(p_vice_captain=any(p_player_ids)) then raise exception 'Captain and vice-captain must belong to the roster'; end if;
  select t.id into v_team from fantasy_user_teams t where t.user_id=v_user and t.season=p_season;
  if v_team is not null and exists(select 1 from fantasy_rounds r where r.season=p_season and r.round_no<9000 and r.deadline_at<=now()) then raise exception 'Season has started. Use the transfer system to change an existing roster.'; end if;
  select max_players_per_club into v_max_club from fantasy_season_rules where season=p_season;
  if v_max_club is null then raise exception 'Fantasy season rules missing for %',p_season; end if;
  select count(*) filter(where fp.position in('C','W')),count(*) filter(where fp.position='D'),count(*) filter(where fp.position='G'),coalesce(sum(sp.price),0)
  into v_f,v_d,v_g,v_total from fantasy_players fp join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season where fp.id=any(p_player_ids) and fp.active=true;
  if v_f+v_d+v_g<>12 then raise exception 'One or more selected players are missing, inactive or have no locked season price'; end if;
  if v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Invalid roster: expected 6F/4D/2G, got %F/%D/%G',v_f,v_d,v_g; end if;
  if v_total>100.00 then raise exception 'Budget exceeded: %m > 100.0m',v_total; end if;
  select fp.team,count(*) into v_club,v_club_count from fantasy_players fp where fp.id=any(p_player_ids) group by fp.team having count(*)>v_max_club order by count(*) desc limit 1;
  if v_club is not null then raise exception 'Too many players from %: % selected, maximum is %',v_club,v_club_count,v_max_club; end if;
  insert into fantasy_user_teams(user_id,season,name,budget,updated_at) values(v_user,p_season,coalesce(nullif(trim(p_name),''),'Mitt lag'),100.00,now())
  on conflict(user_id,season) do update set name=excluded.name,budget=excluded.budget,updated_at=now() returning id into v_team;
  delete from fantasy_user_team_players where team_id=v_team;
  with selected as (
    select fp.id,fp.position,sp.price,row_number() over(partition by case when fp.position in('C','W') then 'F' else fp.position end order by array_position(p_player_ids,fp.id)) as pos_rank
    from fantasy_players fp join fantasy_player_season_prices sp on sp.player_id=fp.id and sp.season=p_season where fp.id=any(p_player_ids)
  )
  insert into fantasy_user_team_players(team_id,player_id,purchase_price,is_captain,is_vice_captain,line_no)
  select v_team,id,price,(id=p_captain),(id=p_vice_captain),case when position in('C','W') and pos_rank<=3 then 1 when position='D' and pos_rank<=2 then 1 when position='G' and pos_rank<=1 then 1 else 2 end from selected;
  return v_team;
end;
$$;

create or replace function public.freeze_fantasy_team_for_round_internal(p_team_id uuid,p_round_id uuid,p_captured_at timestamp with time zone default now())
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_round fantasy_rounds%rowtype; v_team fantasy_user_teams%rowtype; v_snapshot uuid;
  v_count integer; v_f integer; v_d integer; v_g integer; v_captains integer; v_vice integer; v_value numeric;
  v_l1 integer; v_l1f integer; v_l1d integer; v_l1g integer; v_l2 integer; v_l2f integer; v_l2d integer; v_l2g integer;
begin
  select * into v_round from fantasy_rounds where id=p_round_id; if not found then raise exception 'Fantasy round not found'; end if;
  select * into v_team from fantasy_user_teams where id=p_team_id; if not found then raise exception 'Fantasy team not found'; end if;
  if v_team.season is distinct from v_round.season then raise exception 'Team season % does not match round season %',v_team.season,v_round.season; end if;
  select s.id into v_snapshot from fantasy_team_round_snapshots s where s.round_id=v_round.id and s.team_id=v_team.id; if v_snapshot is not null then return v_snapshot; end if;
  select count(*),count(*) filter(where fp.position in('C','W')),count(*) filter(where fp.position='D'),count(*) filter(where fp.position='G'),count(*) filter(where tp.is_captain),count(*) filter(where tp.is_vice_captain),coalesce(sum(tp.purchase_price),0),
    count(*) filter(where tp.line_no=1),count(*) filter(where tp.line_no=1 and fp.position in('C','W')),count(*) filter(where tp.line_no=1 and fp.position='D'),count(*) filter(where tp.line_no=1 and fp.position='G'),
    count(*) filter(where tp.line_no=2),count(*) filter(where tp.line_no=2 and fp.position in('C','W')),count(*) filter(where tp.line_no=2 and fp.position='D'),count(*) filter(where tp.line_no=2 and fp.position='G')
  into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value,v_l1,v_l1f,v_l1d,v_l1g,v_l2,v_l2f,v_l2d,v_l2g
  from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team.id;
  if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Cannot freeze invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g; end if;
  if v_captains<>1 or v_vice<>1 then raise exception 'Cannot freeze team without exactly one captain and one vice-captain'; end if;
  if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then raise exception 'Cannot freeze invalid lineup: each line must contain 1G/2D/3F'; end if;
  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value,captured_at) values(v_round.id,v_team.id,v_team.user_id,v_round.season,v_team.name,v_value,p_captured_at)
  on conflict(round_id,team_id) do nothing returning id into v_snapshot;
  if v_snapshot is null then select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round.id and team_id=v_team.id; return v_snapshot; end if;
  insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no)
  select v_snapshot,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain,tp.line_no from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team.id;
  return v_snapshot;
end;
$$;

create or replace function public.snapshot_fantasy_team_for_round(p_round_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_user uuid:=auth.uid(); v_round fantasy_rounds%rowtype; v_team fantasy_user_teams%rowtype; v_snapshot uuid;
  v_count integer; v_f integer; v_d integer; v_g integer; v_captains integer; v_vice integer; v_value numeric;
  v_l1 integer; v_l1f integer; v_l1d integer; v_l1g integer; v_l2 integer; v_l2f integer; v_l2d integer; v_l2g integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_round from fantasy_rounds where id=p_round_id; if not found then raise exception 'Fantasy round not found'; end if;
  if now()<v_round.deadline_at then raise exception 'Round is not locked yet. Deadline is %',v_round.deadline_at; end if;
  select * into v_team from fantasy_user_teams where user_id=v_user and season=v_round.season; if not found then raise exception 'No fantasy team found for season %',v_round.season; end if;
  select count(*),count(*) filter(where fp.position in('C','W')),count(*) filter(where fp.position='D'),count(*) filter(where fp.position='G'),count(*) filter(where tp.is_captain),count(*) filter(where tp.is_vice_captain),coalesce(sum(tp.purchase_price),0),
    count(*) filter(where tp.line_no=1),count(*) filter(where tp.line_no=1 and fp.position in('C','W')),count(*) filter(where tp.line_no=1 and fp.position='D'),count(*) filter(where tp.line_no=1 and fp.position='G'),
    count(*) filter(where tp.line_no=2),count(*) filter(where tp.line_no=2 and fp.position in('C','W')),count(*) filter(where tp.line_no=2 and fp.position='D'),count(*) filter(where tp.line_no=2 and fp.position='G')
  into v_count,v_f,v_d,v_g,v_captains,v_vice,v_value,v_l1,v_l1f,v_l1d,v_l1g,v_l2,v_l2f,v_l2d,v_l2g
  from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team.id;
  if v_count<>12 or v_f<>6 or v_d<>4 or v_g<>2 then raise exception 'Cannot snapshot invalid roster: expected 6F/4D/2G, got % players (%F/%D/%G)',v_count,v_f,v_d,v_g; end if;
  if v_captains<>1 or v_vice<>1 then raise exception 'Cannot snapshot team without exactly one captain and one vice-captain'; end if;
  if v_l1<>6 or v_l1f<>3 or v_l1d<>2 or v_l1g<>1 or v_l2<>6 or v_l2f<>3 or v_l2d<>2 or v_l2g<>1 then raise exception 'Cannot snapshot invalid lineup: each line must contain 1G/2D/3F'; end if;
  insert into fantasy_team_round_snapshots(round_id,team_id,user_id,season,team_name,squad_value,captured_at) values(v_round.id,v_team.id,v_user,v_round.season,v_team.name,v_value,now())
  on conflict(round_id,team_id) do nothing returning id into v_snapshot;
  if v_snapshot is null then select id into v_snapshot from fantasy_team_round_snapshots where round_id=v_round.id and team_id=v_team.id; return v_snapshot; end if;
  insert into fantasy_team_round_snapshot_players(snapshot_id,player_id,position,team,price,is_captain,is_vice_captain,line_no)
  select v_snapshot,fp.id,fp.position,fp.team,tp.purchase_price,tp.is_captain,tp.is_vice_captain,tp.line_no from fantasy_user_team_players tp join fantasy_players fp on fp.id=tp.player_id where tp.team_id=v_team.id;
  return v_snapshot;
end;
$$;

create or replace function public.calculate_fantasy_round_team_points_internal(p_round_id uuid)
returns table(snapshots_scored integer,player_rows integer,total_points numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_round fantasy_rounds%rowtype; v_snapshot record; v_sp record; v_team_points_id uuid;
  v_captain_multiplier numeric(5,2):=2.00; v_vice_multiplier numeric(5,2):=1.50; v_vice_enabled boolean:=true;
  v_raw numeric(12,2); v_games integer; v_played boolean; v_line_multiplier numeric(5,2); v_role_multiplier numeric(5,2);
  v_line_points numeric(12,2); v_bonus numeric(12,2); v_player_total numeric(12,2); v_base numeric(12,2); v_cap_bonus numeric(12,2); v_vice_bonus numeric(12,2); v_total numeric(12,2);
  v_snapshots integer:=0; v_players integer:=0; v_grand numeric(14,2):=0;
begin
  select * into v_round from fantasy_rounds r where r.id=p_round_id; if not found then raise exception 'Fantasy round not found'; end if;
  select coalesce(sr.captain_multiplier,2.00),coalesce(sr.vice_captain_multiplier,1.50),coalesce(sr.vice_captain_enabled,true) into v_captain_multiplier,v_vice_multiplier,v_vice_enabled from fantasy_season_rules sr where sr.season=v_round.season;
  if not found then v_captain_multiplier:=2.00; v_vice_multiplier:=1.50; v_vice_enabled:=true; end if;
  for v_snapshot in select s.* from fantasy_team_round_snapshots s where s.round_id=v_round.id order by s.captured_at,s.id loop
    insert into fantasy_team_round_points(snapshot_id,round_id,team_id,user_id,season,base_points,captain_bonus,vice_captain_bonus,total_points,calculation_version,calculated_at)
    values(v_snapshot.id,v_round.id,v_snapshot.team_id,v_snapshot.user_id,v_round.season,0,0,0,0,'team-v3-lines-r1-1-r2-0.5-c2-vc1.5',now())
    on conflict(snapshot_id) do update set base_points=0,captain_bonus=0,vice_captain_bonus=0,total_points=0,calculation_version='team-v3-lines-r1-1-r2-0.5-c2-vc1.5',calculated_at=now() returning id into v_team_points_id;
    delete from fantasy_team_round_player_points where team_round_points_id=v_team_points_id;
    v_base:=0; v_cap_bonus:=0; v_vice_bonus:=0; v_total:=0;
    for v_sp in select sp.*,fp.name as player_name from fantasy_team_round_snapshot_players sp join fantasy_players fp on fp.id=sp.player_id where sp.snapshot_id=v_snapshot.id order by sp.line_no,sp.position,fp.name loop
      with latest_points as (
        select distinct on(fpp.player_id,fpp.game_id) fpp.player_id,fpp.game_id,fpp.actual_points from fantasy_player_points fpp join fantasy_games g on g.id=fpp.game_id
        where fpp.player_id=v_sp.player_id and g.fantasy_round_id=v_round.id order by fpp.player_id,fpp.game_id,fpp.calculated_at desc,fpp.id desc
      ) select coalesce(sum(lp.actual_points),0)::numeric,count(lp.game_id)::integer into v_raw,v_games from latest_points lp;
      select exists(select 1 from fantasy_player_game_stats pgs join fantasy_games g on g.id=pgs.game_id where pgs.player_id=v_sp.player_id and g.fantasy_round_id=v_round.id) into v_played;
      v_line_multiplier:=fantasy_line_multiplier(v_sp.line_no); v_role_multiplier:=1.00;
      if v_sp.is_captain and v_played then v_role_multiplier:=v_captain_multiplier; elsif v_sp.is_vice_captain and v_vice_enabled and v_played then v_role_multiplier:=v_vice_multiplier; end if;
      v_line_points:=round(v_raw*v_line_multiplier,2); v_bonus:=round(v_line_points*(v_role_multiplier-1.00),2); v_player_total:=v_line_points+v_bonus;
      insert into fantasy_team_round_player_points(team_round_points_id,snapshot_id,round_id,team_id,player_id,player_name,position,team,is_captain,is_vice_captain,played,games_played,raw_points,line_no,line_multiplier,multiplier,bonus_points,total_points,calculated_at)
      values(v_team_points_id,v_snapshot.id,v_round.id,v_snapshot.team_id,v_sp.player_id,v_sp.player_name,v_sp.position,v_sp.team,v_sp.is_captain,v_sp.is_vice_captain,v_played,v_games,v_raw,v_sp.line_no,v_line_multiplier,v_role_multiplier,v_bonus,v_player_total,now());
      v_base:=v_base+v_line_points; v_total:=v_total+v_player_total;
      if v_sp.is_captain and v_role_multiplier>1 then v_cap_bonus:=v_cap_bonus+v_bonus; elsif v_sp.is_vice_captain and v_role_multiplier>1 then v_vice_bonus:=v_vice_bonus+v_bonus; end if;
      v_players:=v_players+1;
    end loop;
    update fantasy_team_round_points set base_points=v_base,captain_bonus=v_cap_bonus,vice_captain_bonus=v_vice_bonus,total_points=v_total,calculated_at=now() where id=v_team_points_id;
    v_snapshots:=v_snapshots+1; v_grand:=v_grand+v_total;
  end loop;
  return query select v_snapshots,v_players,v_grand;
end;
$$;

create or replace function public.calculate_fantasy_round_team_points(p_round_id uuid)
returns table(snapshots_scored integer,player_rows integer,total_points numeric)
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from players p where p.id=v_user and coalesce(p.admin,false)) then raise exception 'Admin access required'; end if;
  return query select * from calculate_fantasy_round_team_points_internal(p_round_id);
end;
$$;
comment on function public.calculate_fantasy_round_team_points_internal(uuid) is 'Fantasy team scoring v3: raw points × line multiplier (R1 1.0 / R2 0.5), then captain/vice multiplier.';
