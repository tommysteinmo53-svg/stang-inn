import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const activation = read("supabase/mp07-bonus-activation-rpcs-v1.sql");
const hardening = read("supabase/mp12-bonus-rpc-auth-hardening-v1.sql");
const e2eHardening = read("supabase/mp12-lock-e2e-rpcs-v1.sql");
const adminMutatorHardening = read("supabase/mp12-service-only-admin-mutators-v1.sql");

const signatures = [
  "public.select_fantasy_booster_v1(text,text,uuid)",
  "public.cancel_fantasy_booster_v1(text,text)",
  "public.get_my_fantasy_boosters_v1(text)",
];

const e2eSignatures = [
  "public.cleanup_fantasy_achievements_e2e_test()",
  "public.cleanup_fantasy_leaderboard_e2e_test()",
  "public.cleanup_fantasy_scoring_e2e_test(text)",
  "public.cleanup_fantasy_snapshot_test_round(text)",
  "public.create_fantasy_achievements_e2e_test()",
  "public.create_fantasy_leaderboard_e2e_test()",
  "public.create_fantasy_scoring_e2e_test(text)",
  "public.create_fantasy_snapshot_test_round(text)",
  "public.get_fantasy_snapshot_test_state(text)",
  "public.run_fantasy_achievements_e2e_test()",
  "public.run_fantasy_captain_vice_e2e_test()",
  "public.run_fantasy_leaderboard_e2e_test()",
  "public.run_fantasy_my_round_details_e2e_test()",
  "public.run_fantasy_scoring_e2e_test(text)",
  "public.run_fantasy_transfers_e2e_test()",
];

const serviceOnlyAdminMutators = [
  "public.approve_fantasy_player_price_v1(uuid,uuid,numeric,text)",
  "public.publish_fantasy_prices_v461(jsonb,uuid,text,text)",
  "public.publish_fantasy_prices_v462(jsonb,uuid,text,text)",
  "public.reject_fantasy_player_queue_v1(uuid,uuid,text)",
  "public.set_fantasy_player_price_suggestion_v1(uuid,numeric,text,text,jsonb,boolean)",
  "public.sync_fantasy_roster_2026(jsonb,uuid,uuid,uuid)",
];

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check("Personal booster RPCs enforce authenticated user context", (activation.match(/v_user uuid := auth\.uid\(\)/g) ?? []).length >= 3);
check("Personal booster RPCs are SECURITY DEFINER with fixed search_path", (activation.match(/security definer/g) ?? []).length >= 3 && (activation.match(/set search_path=public/g) ?? []).length >= 3);

for (const signature of signatures) {
  check(`${signature}: anon execute is explicitly revoked`, hardening.includes(`revoke all on function ${signature} from public, anon;`));
  check(`${signature}: authenticated execute is explicitly granted`, hardening.includes(`grant execute on function ${signature} to authenticated;`));
}

for (const signature of e2eSignatures) {
  check(`${signature}: client roles cannot execute legacy E2E helper`, e2eHardening.includes(`revoke all on function ${signature} from public, anon, authenticated;`));
  check(`${signature}: controlled service role remains explicit`, e2eHardening.includes(`grant execute on function ${signature} to service_role;`));
}

for (const signature of serviceOnlyAdminMutators) {
  check(`${signature}: direct client execution is revoked`, adminMutatorHardening.includes(`revoke all on function ${signature} from public, anon, authenticated;`));
  check(`${signature}: server service role remains explicit`, adminMutatorHardening.includes(`grant execute on function ${signature} to service_role;`));
}

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failed += 1;
}

if (failed) {
  console.error(`\nMP-12 security contract regression failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`\nPASS ${checks.length}/${checks.length} MP-12 security contract checks.`);
