-- MP-12.3 / MP-12.7 – harden internal data-integrity diagnostics.
-- The view is operational diagnostics, not a player-facing API.
-- SECURITY INVOKER avoids owner-privilege/RLS bypass and direct client access is removed.

alter view public.data_integrity_report set (security_invoker=true);

revoke all on public.data_integrity_report from public, anon, authenticated;
grant select on public.data_integrity_report to service_role;
