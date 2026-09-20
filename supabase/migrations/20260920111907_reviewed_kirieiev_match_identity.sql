-- Reviewed distinct match identity; no player prices, ownership or history changes.
CREATE OR REPLACE FUNCTION public.guard_ep_provisional_nif_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_candidates integer;
begin

  if new.external_id is null
     or new.external_id not like 'nif:%'
  then
    return new;
  end if;


  -- Existing NIF identity: normal update/upsert.
  if exists (
    select 1
    from fantasy_players fp
    where fp.external_id = new.external_id
  ) then
    return new;
  end if;


  select count(*)
  into v_candidates
  from fantasy_players fp
  where fp.active = true
    and fp.on_current_roster = true
    and fp.external_id like 'ep:%'
    and fantasy_team_key(fp.team) = fantasy_team_key(new.team)
    and (
      fp.position = new.position
      or (
        fp.position in ('C','W')
        and new.position in ('C','W')
      )
    );


  -- HockeyLive 8393585 (2026-09-19): Artur Kirieiev, #21, org 220882.
  -- Reviewed as distinct from the sole provisional Stavanger forward,
  -- Ludwig Blomstrand (ep:21651, already mapped to nif:10593261).
  -- Keep the gate for every other identity and any additional candidate.
  if new.external_id='nif:9800252'
     and new.name='Artur Kirieiev'
     and fantasy_team_key(new.team)='stavanger'
     and not exists (
       select 1 from fantasy_players fp
       where fp.active and fp.on_current_roster
         and fp.external_id like 'ep:%' and fp.external_id<>'ep:21651'
         and fantasy_team_key(fp.team)=fantasy_team_key(new.team)
         and (fp.position=new.position or (fp.position in ('C','W') and new.position in ('C','W')))
     ) then
    return new;
  end if;

  if v_candidates > 0 then
    raise exception
      'MP-02 identity gate: new NIF identity % (%) may correspond to % EP-provisional player(s) on %. Reconcile explicitly before insert.',
      new.external_id,
      new.name,
      v_candidates,
      new.team;
  end if;


  return new;

end $function$
;
