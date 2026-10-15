-- Migration: preserve established fantasy positions when freezing later rounds.
-- Only the permanent-team branch is rewritten. Event-team handling stays unchanged.
-- Review and test in staging before deploying.
do $migration$
declare
  original_def text;
  updated_def text;
  split_at integer;
  marker text := '  select count(*),count(*) filter(where fp.position in (''C'',''W''))';
  suffix text;
begin
  select pg_get_functiondef(p.oid) into original_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='freeze_fantasy_team_for_round_internal';
  if original_def is null then raise exception 'Freeze function not found'; end if;
  split_at := strpos(original_def, marker);
  if split_at = 0 then raise exception 'Freeze function structure has changed'; end if;
  -- There are two roster validations: event first, permanent second.
  split_at := strpos(original_def, marker);
  split_at := strpos(substr(original_def, split_at + length(marker)), marker) + split_at + length(marker) - 1;
  if split_at < length(marker) then raise exception 'Permanent roster validation not found'; end if;
  suffix := substr(original_def, split_at);
  if strpos(suffix, 'from fantasy_user_team_players tp') = 0 then
    raise exception 'Expected permanent-team validation missing';
  end if;
  updated_def := substr(original_def, 1, split_at - 1) ||
    replace(suffix, 'fp.position', 'public.fantasy_position_at_round_v1(v_team.id,fp.id,v_round.id)');
  execute updated_def;
end
$migration$;
