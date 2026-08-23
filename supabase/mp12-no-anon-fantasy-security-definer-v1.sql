-- MP-12.3 / MP-12.7 – global Fantasy SECURITY DEFINER anonymous-execute hardening.
-- Product contract: Fantasy is authenticated-only except the static rules page.
-- This migration changes only EXECUTE privileges; it does not alter function bodies,
-- RLS policies, scoring rules or data.

do $mp12$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef=true
      and (
        p.proname like '%fantasy%'
        or p.proname like 'get_my_fantasy%'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.signature);
  end loop;
end
$mp12$;
