-- Phase 1: independent of whether the league chooses 40 or 48 games per club.
-- Apply before the first deadline; schema and guarded data correction commit atomically.
begin;

alter table public.matches add column if not exists cancelled boolean not null default false;
alter table public.matches add column if not exists cancellation_reason text;
alter table public.ehl_standings add column if not exists active boolean not null default true;

create table if not exists public.competition_adjustment_audit (
  adjustment text not null,
  scope text not null,
  before_rows jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (adjustment, scope)
);
alter table public.competition_adjustment_audit enable row level security;
revoke all on public.competition_adjustment_audit from public, anon, authenticated;
grant select, insert on public.competition_adjustment_audit to service_role;

create or replace function public.is_withdrawn_ehl_team(p_season text, p_team text)
returns boolean language sql immutable security invoker
set search_path = public, pg_temp
as $$
  select coalesce(p_season = '2026/27' and lower(btrim(p_team)) = any(array[
    'sparta', 'sparta elite', 'sparta sarpsborg', 'sparta ishockey elite',
    'sparta ishockey elite, il - ishockey'
  ]), false);
$$;
revoke all on function public.is_withdrawn_ehl_team(text,text) from public;
grant execute on function public.is_withdrawn_ehl_team(text,text) to anon, authenticated, service_role;

create or replace function public.guard_withdrawn_ehl_fixture()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if public.is_withdrawn_ehl_team(new.season,new.home_team)
     or public.is_withdrawn_ehl_team(new.season,new.away_team) then
    new.home_score := null;
    new.away_score := null;
    if tg_table_name = 'matches' then
      new.cancelled := true;
      new.cancellation_reason := 'Sparta deltar ikke i EHL 2026/27';
      new.finished := false;
    else
      new.status := 'cancelled';
      new.fantasy_round_id := null;
      new.fantasy_round_no := null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_withdrawn_ehl_fixture() from public, anon, authenticated;
drop trigger if exists withdrawn_ehl_match_guard on public.matches;
create trigger withdrawn_ehl_match_guard before insert or update on public.matches
for each row execute function public.guard_withdrawn_ehl_fixture();
drop trigger if exists withdrawn_ehl_game_guard on public.fantasy_games;
create trigger withdrawn_ehl_game_guard before insert or update on public.fantasy_games
for each row execute function public.guard_withdrawn_ehl_fixture();

create or replace function public.guard_withdrawn_ehl_player()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  -- fantasy_players is the current player registry, not a historical season roster.
  if public.is_withdrawn_ehl_team('2026/27',new.team) then
    new.active := false;
    new.on_current_roster := false;
    new.available_for_purchase := false;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_withdrawn_ehl_player() from public, anon, authenticated;
drop trigger if exists withdrawn_ehl_player_guard on public.fantasy_players;
create trigger withdrawn_ehl_player_guard before insert or update on public.fantasy_players
for each row execute function public.guard_withdrawn_ehl_player();

create or replace function public.guard_withdrawn_ehl_standing()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if public.is_withdrawn_ehl_team(new.season,new.team) then
    new.active := false;
    -- Keep the original standing row for audit/history, outside the active 1–9 table.
    new.position := 10;
    new.played := 0;
    new.points := 0;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_withdrawn_ehl_standing() from public, anon, authenticated;
drop trigger if exists withdrawn_ehl_standing_guard on public.ehl_standings;
create trigger withdrawn_ehl_standing_guard before insert or update on public.ehl_standings
for each row execute function public.guard_withdrawn_ehl_standing();

create or replace function public.guard_tip_deadline()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare kickoff timestamptz; is_cancelled boolean;
begin
  select m.match_time, m.cancelled into kickoff, is_cancelled
  from public.matches m where m.id=new.match_id;
  if is_cancelled then raise exception 'Kampen er annullert og kan ikke tippes'; end if;
  if kickoff is null then raise exception 'Kampen mangler kampstart og kan ikke tippes'; end if;
  if now() >= kickoff then raise exception 'Tipset er låst fordi kampen har startet'; end if;
  return new;
end;
$$;
revoke all on function public.guard_tip_deadline() from public, anon, authenticated;

create or replace function public.save_table_tip_rankings(teams text[])
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid(); cfg jsonb; tip_season text;
  expected_count integer; valid_team_count integer;
begin
  if uid is null then raise exception 'Ikke innlogget'; end if;
  select value into cfg from public.app_settings where key='table_tips';
  if cfg is null or nullif(cfg->>'season','') is null then
    raise exception 'Tabelltips-konfigurasjon mangler';
  end if;
  tip_season := cfg->>'season';
  expected_count := (cfg->>'team_count')::integer;
  if expected_count is null or expected_count < 2 then
    raise exception 'Antall aktive EHL-lag er ikke konfigurert';
  end if;
  if public.table_tips_is_locked() then raise exception 'Tabelltipset er låst'; end if;
  if coalesce(array_length(teams,1),0) <> expected_count then
    raise exception 'Tabelltipset må inneholde nøyaktig % lag', expected_count;
  end if;
  if (select count(distinct team) from unnest(teams) as team) <> expected_count then
    raise exception 'Hvert lag kan bare brukes én gang';
  end if;
  select count(*) into valid_team_count from unnest(teams) submitted(team)
  join public.ehl_standings es on es.season=tip_season and es.team=submitted.team
  where es.active and not public.is_withdrawn_ehl_team(es.season,es.team);
  if valid_team_count <> expected_count then raise exception 'Tabelltipset inneholder ugyldige EHL-lag'; end if;
  if (select count(*) from public.ehl_standings es where es.season=tip_season and es.active
      and not public.is_withdrawn_ehl_team(es.season,es.team)) <> expected_count then
    raise exception 'EHL-tabellen er ikke komplett for %',tip_season;
  end if;
  delete from public.table_tips where player_id=uid;
  insert into public.table_tips(player_id,team,position)
  select uid,team,ordinality::integer from unnest(teams) with ordinality ranked(team,ordinality);
end;
$$;
revoke all on function public.save_table_tip_rankings(text[]) from public, anon;
grant execute on function public.save_table_tip_rankings(text[]) to authenticated;
-- Complete nine-club submissions must pass the RPC; direct writes bypass its validation.
revoke insert, update, delete, truncate, references, trigger on public.table_tips from anon, authenticated;

create or replace view public.table_tip_deviation with (security_invoker=true) as
select tt.player_id,tt.team,tt.position as predicted_position,es.position as actual_position,
abs(tt.position-es.position) as deviation
from public.table_tips tt join public.ehl_standings es on es.team=tt.team and es.season='2026/27'
where es.active and not public.is_withdrawn_ehl_team(es.season,es.team);

-- One-time, pre-deadline correction. The transaction locks writes while archiving and converting.
lock table public.matches, public.fantasy_games,
  public.fantasy_players, public.ehl_standings, public.table_tips,
  public.fantasy_rounds, public.fantasy_team_round_snapshots in share row exclusive mode;

do $adjustment$
declare
  cfg jsonb; item record; scope_name text; payload jsonb;
  adjustment_key constant text := 'sparta-withdrawal-2026-27-v1';
begin
  if exists(select 1 from public.competition_adjustment_audit
    where adjustment=adjustment_key and scope='complete') then return; end if;
  select value into cfg from public.app_settings where key='table_tips' for update;
  if cfg->>'season' is distinct from '2026/27' then raise exception 'Unexpected table-tip season'; end if;
  if nullif(cfg->>'deadline','') is null or (cfg->>'deadline')::timestamptz<=now() then
    raise exception 'Preseason correction must run before the table-tip deadline';
  end if;
  if exists(select 1 from public.fantasy_rounds where season='2026/27' and deadline_at<=now())
    or exists(select 1 from public.fantasy_team_round_snapshots where season='2026/27')
    or exists(select 1 from public.matches where season='2026/27' and finished)
    or exists(select 1 from public.fantasy_games where season='2026/27' and status='finished') then
    raise exception 'Season has started: stop and use a reviewed in-season correction';
  end if;
  if exists(select 1 from public.tips t join public.matches m on m.id=t.match_id
    where (public.is_withdrawn_ehl_team(m.season,m.home_team) or public.is_withdrawn_ehl_team(m.season,m.away_team))
      and t.points is not null) then raise exception 'Unexpected scored Sparta tips'; end if;
  if (select count(*) from public.ehl_standings where season='2026/27'
    and not public.is_withdrawn_ehl_team(season,team))<>9 then raise exception 'Expected nine remaining EHL clubs'; end if;
  if exists(select 1 from public.table_tips group by player_id
    having count(*)<>10 or count(*) filter(where team='Sparta')<>1) then
    raise exception 'Incomplete or already partly converted table tips require review';
  end if;

  for scope_name,payload in
    select 'matches',coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from public.matches m
      where public.is_withdrawn_ehl_team(m.season,m.home_team) or public.is_withdrawn_ehl_team(m.season,m.away_team)
    union all select 'fantasy_games',coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) from public.fantasy_games g
      where public.is_withdrawn_ehl_team(g.season,g.home_team) or public.is_withdrawn_ehl_team(g.season,g.away_team)
    union all select 'fantasy_round_games',coalesce(jsonb_agg(to_jsonb(rg)),'[]'::jsonb) from public.fantasy_round_games rg
      join public.fantasy_games g on g.id=rg.game_id
      where public.is_withdrawn_ehl_team(g.season,g.home_team) or public.is_withdrawn_ehl_team(g.season,g.away_team)
    union all select 'fantasy_players',coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.fantasy_players p
      where public.is_withdrawn_ehl_team('2026/27',p.team)
    union all select 'table_tips',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.table_tips t
    union all select 'ehl_standings',coalesce(jsonb_agg(to_jsonb(es)),'[]'::jsonb) from public.ehl_standings es where season='2026/27'
    union all select 'settings',coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from public.app_settings s where key in('table_tips','ehl_2026_27_format')
  loop
    insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
      values(adjustment_key,scope_name,payload);
  end loop;

  update public.matches set cancelled=true where season='2026/27'
    and (public.is_withdrawn_ehl_team(season,home_team) or public.is_withdrawn_ehl_team(season,away_team));
  -- fantasy_round_games is an internal view; clearing the authoritative game links updates it.
  update public.fantasy_games set status='cancelled',updated_at=now() where season='2026/27'
    and (public.is_withdrawn_ehl_team(season,home_team) or public.is_withdrawn_ehl_team(season,away_team));
  update public.fantasy_players set active=false,on_current_roster=false,available_for_purchase=false,updated_at=now()
    where public.is_withdrawn_ehl_team('2026/27',team);

  update public.ehl_standings set active=false where season='2026/27' and public.is_withdrawn_ehl_team(season,team);
  for item in select id,row_number() over(order by position)::integer new_position
    from public.ehl_standings where season='2026/27' and active order by position
  loop update public.ehl_standings set position=item.new_position where id=item.id; end loop;

  -- Original ten-row submissions are in the private audit; no users lose their entry.
  delete from public.table_tips where team='Sparta';
  for item in select id,row_number() over(partition by player_id order by position)::integer new_position
    from public.table_tips order by player_id,position
  loop update public.table_tips set position=item.new_position where id=item.id; end loop;
  update public.app_settings set value=jsonb_set(value,'{team_count}','9'::jsonb) where key='table_tips';
  insert into public.app_settings(key,value) values('ehl_2026_27_format',
    '{"status":"pending","games_per_team":null,"total_games":null,"calendar_provisional":true}'::jsonb)
    on conflict(key) do update set value=excluded.value;

  if exists(select 1 from public.table_tips group by player_id
    having count(*)<>9 or min(position)<>1 or max(position)<>9) then raise exception 'Converted rankings failed validation'; end if;
  if exists(select 1 from public.fantasy_rounds r where r.season='2026/27'
    and not exists(select 1 from public.fantasy_games g where g.fantasy_round_id=r.id and g.status<>'cancelled')) then
    raise exception 'Empty fantasy round requires a separate reviewed correction';
  end if;
  insert into public.competition_adjustment_audit(adjustment,scope,before_rows)
    values(adjustment_key,'complete','{"phase":1,"format":"pending"}'::jsonb);
end;
$adjustment$;

-- Preserve all existing RLS policies, privileged function boundaries and deadline rules.
notify pgrst, 'reload schema';
commit;
