-- Already reconciled EP players are not unresolved candidates for every newcomer.
-- Preserve their canonical UUIDs/prices and protect matching IDs/surnames.
-- Reviewed aliases also live in lib/fantasy/match-player-identities.ts.
CREATE OR REPLACE FUNCTION public.guard_ep_provisional_nif_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_candidates integer;
begin
  if new.external_id is null or new.external_id not like 'nif:%' then return new; end if;
  if exists(select 1 from fantasy_players fp where fp.external_id=new.external_id) then return new; end if;

  select count(*) into v_candidates
  from fantasy_players fp
  where fp.active and fp.on_current_roster and fp.external_id like 'ep:%'
    and fantasy_team_key(fp.team)=fantasy_team_key(new.team)
    and (fp.position=new.position or (fp.position in ('C','W') and new.position in ('C','W')))
    and not (
      -- HockeyLive 8393581: verified Ludwig Blomstrand identity.
      (fp.external_id='ep:21651' and fp.name='Ludwig Blomstrand'
       and fantasy_team_key(fp.team)='stavanger'
       and new.external_id<>'nif:10593261'
       and new.name !~* 'blomstrand')
      or
      -- HockeyLive 8393585: verified Alexander Bjurström identity.
      (fp.external_id='ep:244694' and fp.name='Alexander Bjurström'
       and fantasy_team_key(fp.team)='nidaros'
       and new.external_id<>'nif:10577828'
       and new.name !~* 'bjurstr')
    );
  if v_candidates>0 then
    raise exception 'MP-02 identity gate: new NIF identity % (%) may correspond to % EP-provisional player(s) on %. Reconcile explicitly before insert.',new.external_id,new.name,v_candidates,new.team;
  end if;
  return new;
end
$function$;
