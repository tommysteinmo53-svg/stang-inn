-- Stang Inn Fantasy Hockey – v0.9
-- Atomic sync of the current HockeyLive roster into fantasy_players.
-- Does NOT deactivate stale players outside the supplied roster.

create or replace function sync_fantasy_roster_2026(
  p_rows jsonb,
  p_admin uuid,
  p_duplicate_keep uuid,
  p_duplicate_drop uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_name text;
  v_team text;
  v_position text;
  v_external text;
  v_count integer;
  v_matches integer;
  v_player fantasy_players%rowtype;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_duplicate_fixed integer := 0;
  v_conflicts integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Roster payload must be a JSON array';
  end if;

  v_count := jsonb_array_length(p_rows);
  if v_count < 200 or v_count > 300 then
    raise exception 'Unexpected roster size: %', v_count;
  end if;

  if not exists(select 1 from players where id = p_admin and admin = true) then
    raise exception 'Publisher is not an admin';
  end if;

  -- Resolve the one verified duplicate without deleting historical rows.
  if p_duplicate_keep is not null and p_duplicate_drop is not null then
    if not exists(select 1 from fantasy_players where id = p_duplicate_keep)
       or not exists(select 1 from fantasy_players where id = p_duplicate_drop) then
      raise exception 'Verified duplicate IDs not found';
    end if;
    if lower((select name from fantasy_players where id=p_duplicate_keep)) <>
       lower((select name from fantasy_players where id=p_duplicate_drop)) then
      raise exception 'Duplicate IDs do not refer to the same player name';
    end if;
    update fantasy_players
      set active=false,
          external_id='legacy-duplicate:' || id::text,
          updated_at=now()
      where id=p_duplicate_drop;
    v_duplicate_fixed := 1;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_name := btrim(v_row->>'name');
    v_team := btrim(v_row->>'team');
    v_position := upper(btrim(v_row->>'position'));
    v_external := case when nullif(btrim(v_row->>'personId'),'') is null then null else 'nif:' || btrim(v_row->>'personId') end;

    if coalesce(v_name,'')='' or coalesce(v_team,'')='' then
      raise exception 'Roster row missing name/team: %', v_row;
    end if;
    if v_position not in ('C','W','D','G') then
      raise exception 'Invalid/missing position for %: %', v_name, v_position;
    end if;

    select count(*) into v_matches
    from fantasy_players fp
    where fp.active=true and lower(fp.name)=lower(v_name);

    if v_matches > 1 then
      raise exception 'Ambiguous active fantasy_players match for %: %', v_name, v_matches;
    end if;

    if v_external is not null then
      select count(*) into v_conflicts
      from fantasy_players fp
      where fp.external_id=v_external
        and not (fp.active=true and lower(fp.name)=lower(v_name));
      if v_conflicts > 0 then
        raise exception 'External ID conflict for %: %', v_name, v_external;
      end if;
    end if;

    if v_matches = 1 then
      select * into v_player
      from fantasy_players fp
      where fp.active=true and lower(fp.name)=lower(v_name)
      limit 1;

      update fantasy_players
      set team=v_team,
          position=v_position,
          external_id=coalesce(v_external, external_id),
          active=true,
          updated_at=now()
      where id=v_player.id;
      v_updated := v_updated + 1;
    else
      insert into fantasy_players(external_id,name,team,position,price,active)
      values(v_external,v_name,v_team,v_position,null,true);
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'rosterCount',v_count,
    'inserted',v_inserted,
    'updated',v_updated,
    'duplicateFixed',v_duplicate_fixed
  );
end;
$$;

revoke all on function sync_fantasy_roster_2026(jsonb,uuid,uuid,uuid) from public;
grant execute on function sync_fantasy_roster_2026(jsonb,uuid,uuid,uuid) to service_role;
