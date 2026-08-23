begin;

create or replace function public.table_tips_is_locked()
returns boolean
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  cfg jsonb;
  deadline_value timestamptz;
begin
  select value into cfg
  from public.app_settings
  where key = 'table_tips';

  if cfg is null or nullif(cfg->>'deadline', '') is null then
    return true;
  end if;

  begin
    deadline_value := (cfg->>'deadline')::timestamptz;
  exception when others then
    return true;
  end;

  return now() >= deadline_value;
end;
$$;

revoke all on function public.table_tips_is_locked() from public;
revoke execute on function public.table_tips_is_locked() from anon;
revoke execute on function public.table_tips_is_locked() from authenticated;
grant execute on function public.table_tips_is_locked() to authenticated;

create or replace function public.save_table_tip_rankings(teams text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  cfg jsonb;
  tip_season text;
  valid_team_count integer;
begin
  if uid is null then
    raise exception 'Ikke innlogget';
  end if;

  select value into cfg
  from public.app_settings
  where key = 'table_tips';

  if cfg is null or nullif(cfg->>'season', '') is null then
    raise exception 'Tabelltips-konfigurasjon mangler';
  end if;

  tip_season := cfg->>'season';

  if public.table_tips_is_locked() then
    raise exception 'Tabelltipset er låst';
  end if;

  if coalesce(array_length(teams, 1), 0) <> 10 then
    raise exception 'Tabelltipset må inneholde nøyaktig 10 lag';
  end if;

  if (select count(distinct team) from unnest(teams) as team) <> 10 then
    raise exception 'Hvert lag kan bare brukes én gang';
  end if;

  select count(*) into valid_team_count
  from unnest(teams) as submitted(team)
  join public.ehl_standings standings
    on standings.season = tip_season
   and standings.team = submitted.team;

  if valid_team_count <> 10 then
    raise exception 'Tabelltipset inneholder ugyldige EHL-lag';
  end if;

  if (select count(*) from public.ehl_standings where season = tip_season) <> 10 then
    raise exception 'EHL-tabellen er ikke komplett for %', tip_season;
  end if;

  delete from public.table_tips
  where player_id = uid;

  insert into public.table_tips (player_id, team, position)
  select uid, team, ordinality::integer
  from unnest(teams) with ordinality as ranked(team, ordinality);
end;
$$;

revoke all on function public.save_table_tip_rankings(text[]) from public;
revoke execute on function public.save_table_tip_rankings(text[]) from anon;
revoke execute on function public.save_table_tip_rankings(text[]) from authenticated;
grant execute on function public.save_table_tip_rankings(text[]) to authenticated;

create or replace function public.guard_tip_deadline()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  kickoff timestamptz;
begin
  select m.match_time into kickoff
  from public.matches m
  where m.id = new.match_id;

  if kickoff is null then
    raise exception 'Kampen mangler kampstart og kan ikke tippes';
  end if;

  if now() >= kickoff then
    raise exception 'Tipset er låst fordi kampen har startet';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_tip_deadline() from public;
revoke execute on function public.guard_tip_deadline() from anon;
revoke execute on function public.guard_tip_deadline() from authenticated;

create or replace function public.touch_table_tips_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_table_tips_updated_at() from public;
revoke execute on function public.touch_table_tips_updated_at() from anon;
revoke execute on function public.touch_table_tips_updated_at() from authenticated;

commit;
