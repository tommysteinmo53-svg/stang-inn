-- MP-12.3 / MP-12.7 – remove legacy E2E helpers that can write inside the real 2026/27 namespace.
-- Safe replacements must use synthetic seasons before these capabilities are reintroduced.

-- Snapshot v0.20
drop function if exists public.create_fantasy_snapshot_test_round(text);
drop function if exists public.get_fantasy_snapshot_test_state(text);
drop function if exists public.cleanup_fantasy_snapshot_test_round(text);

-- Team scoring v0.22
drop function if exists public.create_fantasy_scoring_e2e_test(text);
drop function if exists public.run_fantasy_scoring_e2e_test(text);
drop function if exists public.cleanup_fantasy_scoring_e2e_test(text);

-- Transfers v0.28.3
drop function if exists public.run_fantasy_transfers_e2e_test();

-- Captain / vice v0.30.1
drop function if exists public.run_fantasy_captain_vice_e2e_test();
