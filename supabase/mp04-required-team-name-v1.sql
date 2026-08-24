-- Stang Inn XI – MP-04.8
-- Mandatory Fantasy team names without rewriting existing team identity/history.

create or replace function normalize_fantasy_team_name_v1(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text;
begin
  if p_name is null then
    raise exception 'Fantasy team name is required';
  end if;

  if p_name ~ '[[:cntrl:]]' then
    raise exception 'Fantasy team name contains invalid control characters';
  end if;

  v_name := regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g');

  if char_length(v_name) < 3 or char_length(v_name) > 40 then
    raise exception 'Fantasy team name must be between 3 and 40 characters';
  end if;

  if lower(v_name) in ('mitt lag','my team','lag') then
    raise exception 'Choose a personal Fantasy team name instead of a placeholder';
  end if;

  if v_name !~ '[[:alnum:]]' then
    raise exception 'Fantasy team name must contain at least one letter or number';
  end if;

  return v_name;
end;
$$;

revoke all on function normalize_fantasy_team_name_v1(text) from public;
revoke all on function normalize_fantasy_team_name_v1(text) from anon;
revoke all on function normalize_fantasy_team_name_v1(text) from authenticated;

create or replace function enforce_fantasy_team_name_v1()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  new.name := normalize_fantasy_team_name_v1(new.name);
  return new;
end;
$$;

drop trigger if exists fantasy_user_teams_require_name_v1 on fantasy_user_teams;
create trigger fantasy_user_teams_require_name_v1
before insert or update of name on fantasy_user_teams
for each row execute function enforce_fantasy_team_name_v1();

create or replace function rename_fantasy_team_v1(
  p_season text,
  p_name text
) returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_team uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if p_season <> '2026/27' then
    raise exception 'Unsupported fantasy season: %',p_season;
  end if;

  v_name := normalize_fantasy_team_name_v1(p_name);

  update fantasy_user_teams t
  set name=v_name,updated_at=now()
  where t.user_id=v_user and t.season=p_season
  returning t.id into v_team;

  if v_team is null then
    raise exception 'Fantasy team not found for season %',p_season;
  end if;

  return v_name;
end;
$$;

revoke all on function rename_fantasy_team_v1(text,text) from public;
revoke all on function rename_fantasy_team_v1(text,text) from anon;
grant execute on function rename_fantasy_team_v1(text,text) to authenticated;

comment on function normalize_fantasy_team_name_v1(text) is
  'MP-04.8 canonical Fantasy team-name validation: 3-40 chars, no control chars/placeholders, requires alphanumeric content.';
comment on function rename_fantasy_team_v1(text,text) is
  'MP-04.8 authenticated rename-only path. Changes fantasy_user_teams.name without touching roster, transfers, snapshots, boosters or scoring.';
