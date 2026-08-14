-- Stang Inn Fantasy Hockey – v0.19.1
-- Repair installations where the v0.13 vice-captain column was not present.
-- Safe to run repeatedly.

alter table fantasy_user_team_players
  add column if not exists is_vice_captain boolean not null default false;

-- Preserve data if an older/manual schema used an alternative vice-captain column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='fantasy_user_team_players'
      and column_name='is_vice'
  ) then
    execute 'update fantasy_user_team_players set is_vice_captain=coalesce(is_vice,false) where coalesce(is_vice,false)=true';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='fantasy_user_team_players'
      and column_name='vice_captain'
  ) then
    execute 'update fantasy_user_team_players set is_vice_captain=coalesce(vice_captain,false) where coalesce(vice_captain,false)=true';
  end if;
end;
$$;

comment on column fantasy_user_team_players.is_vice_captain is
  'True for the selected vice-captain on the user live fantasy team.';

-- Quick schema assertion so a partially applied repair cannot go unnoticed.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='fantasy_user_team_players'
      and column_name='is_vice_captain'
  ) then
    raise exception 'Schema repair failed: fantasy_user_team_players.is_vice_captain is still missing';
  end if;
end;
$$;
