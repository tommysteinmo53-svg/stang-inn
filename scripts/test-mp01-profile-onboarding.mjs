import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authGate = await readFile(new URL("../components/AuthGate.tsx", import.meta.url), "utf8");
const onboarding = await readFile(new URL("../app/onboarding/page.tsx", import.meta.url), "utf8");
const profileSql = await readFile(new URL("../supabase/mp01-profile-onboarding-v1.sql", import.meta.url), "utf8");
const hotfixSql = await readFile(new URL("../supabase/mp01-profile-onboarding-hotfix-v2.sql", import.meta.url), "utf8");
const securitySql = await readFile(new URL("../supabase/mp01-profile-security-v1.sql", import.meta.url), "utf8");

const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, ok: false });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

await check("AuthGate reads explicit profile completion state", () => {
  assert.match(authGate, /profile_name_confirmed_at/);
  assert.match(authGate, /hasCompleteProfile/);
});

await check("Incomplete profiles cannot bypass onboarding by direct navigation", () => {
  assert.match(authGate, /if \(!complete && !onboardingPage\)/);
  assert.match(authGate, /window\.location\.replace\(`\/onboarding\?next=/);
  assert.match(authGate, /if \(!ready\) return/);
});

await check("AuthGate no longer auto-creates a profile from Google or email", () => {
  assert.doesNotMatch(authGate, /\.upsert\(/);
  assert.doesNotMatch(authGate, /user_metadata\?\.display_name/);
  assert.doesNotMatch(authGate, /split\("@"\)/);
});

await check("Onboarding requires an explicit save through the profile RPC", () => {
  assert.match(onboarding, /complete_stanginn_profile_v1/);
  assert.match(onboarding, /Bekreft profilnavn/);
  assert.match(onboarding, /minLength=\{2\}/);
  assert.match(onboarding, /maxLength=\{60\}/);
});

await check("Google metadata is suggestion-only", () => {
  assert.match(onboarding, /suggestedAuthName/);
  assert.match(onboarding, /setName\(/);
  assert.match(onboarding, /async function submit/);
});

await check("Server-side profile validation rejects invalid lengths and control characters", () => {
  assert.match(profileSql, /length\(v_name\) < 2/);
  assert.match(profileSql, /length\(v_name\) > 60/);
  assert.match(profileSql, /\[\[:cntrl:\]\]/);
  assert.match(profileSql, /regexp_replace\(btrim/);
});

await check("Profile RPC is authenticated-only and pinned to the player primary key", () => {
  assert.match(hotfixSql, /on conflict on constraint players_pkey/);
  assert.match(hotfixSql, /revoke all on function public\.complete_stanginn_profile_v1\(text\) from public/);
  assert.match(hotfixSql, /revoke all on function public\.complete_stanginn_profile_v1\(text\) from anon/);
  assert.match(hotfixSql, /grant execute on function public\.complete_stanginn_profile_v1\(text\) to authenticated/);
});

await check("Direct profile writes and email reads are not granted to competition clients", () => {
  assert.match(securitySql, /revoke insert, update, delete/);
  assert.match(securitySql, /revoke select on table public\.players from anon, authenticated/);
  assert.match(securitySql, /grant select \(id, display_name, avatar, admin, created_at, profile_name_confirmed_at\)/);
  assert.doesNotMatch(securitySql.match(/grant select \([^)]*\)/)?.[0] ?? "", /email/);
});

const failed = checks.filter((row) => !row.ok);
if (failed.length) {
  console.error(`\nMP-01.7 profile onboarding regression failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\nPASS ${checks.length}/${checks.length} MP-01.7 profile onboarding checks.`);
