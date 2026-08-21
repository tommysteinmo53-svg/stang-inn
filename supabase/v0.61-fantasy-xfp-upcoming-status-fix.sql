-- MP-08: upcoming fixture status filter repair
--
-- Production symptom:
-- Stavanger players were present in get_fantasy_xfp_admin_v1, but all received
-- xFP = 0 because the negative status predicate used in the upcoming-fixture CTE
-- produced no qualifying rows for Stavanger. An explicit allow-list for active
-- upcoming statuses returns the correct schedule rows and avoids changing any
-- xFP weights or Fantasy scoring rules.
--
-- This migration updates both the ranking RPC and the per-player fixture RPC.

do $$
declare
  r record;
  v_def text;
  v_new text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_fantasy_xfp_admin_v1',
        'get_fantasy_xfp_player_fixtures_admin_v1'
      )
  loop
    v_def := pg_get_functiondef(r.oid);

    v_new := regexp_replace(
      v_def,
      E'coalesce\\(\\s*g\\.status,\\s*''scheduled''\\s*\\)\\s*not in\\(\\s*''finished'',\\s*''cancelled''\\s*\\)',
      E'(g.status is null or g.status in (''scheduled'',''postponed'',''live'',''in_progress''))',
      'gi'
    );

    if v_new = v_def then
      raise exception 'Expected upcoming-status filter not found in %', r.proname;
    end if;

    execute v_new;
  end loop;
end $$;
