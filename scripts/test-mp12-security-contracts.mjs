import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const activation = read("supabase/mp07-bonus-activation-rpcs-v1.sql");
const hardening = read("supabase/mp12-bonus-rpc-auth-hardening-v1.sql");

const signatures = [
  "public.select_fantasy_booster_v1(text,text,uuid)",
  "public.cancel_fantasy_booster_v1(text,text)",
  "public.get_my_fantasy_boosters_v1(text)",
];

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check("Personal booster RPCs enforce authenticated user context", (activation.match(/v_user uuid := auth\.uid\(\)/g) ?? []).length >= 3);
check("Personal booster RPCs are SECURITY DEFINER with fixed search_path", (activation.match(/security definer/g) ?? []).length >= 3 && (activation.match(/set search_path=public/g) ?? []).length >= 3);

for (const signature of signatures) {
  check(`${signature}: anon execute is explicitly revoked`, hardening.includes(`revoke all on function ${signature} from public, anon;`));
  check(`${signature}: authenticated execute is explicitly granted`, hardening.includes(`grant execute on function ${signature} to authenticated;`));
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
