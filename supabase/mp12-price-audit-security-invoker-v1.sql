-- MP-12 security hardening: the price-publication audit is read-only and should
-- respect the existing admin-only RLS policies on fantasy_price_publications
-- and fantasy_price_publication_rows instead of bypassing them as DEFINER.

alter function public.audit_fantasy_price_publication(uuid) security invoker;
