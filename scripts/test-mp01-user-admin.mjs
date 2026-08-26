import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/admin/users/page.tsx", import.meta.url), "utf8");
const authGate = await readFile(new URL("../components/AuthGate.tsx", import.meta.url), "utf8");
const sql = await readFile(new URL("../supabase/mp01-user-admin-lifecycle-v1.sql", import.meta.url), "utf8");

const checks=[];
async function check(name,fn){try{await fn();checks.push({name,ok:true});console.log(`PASS ${name}`)}catch(error){checks.push({name,ok:false});console.error(`FAIL ${name}`);console.error(error)}}

await check("Admin API requires an active administrator",()=>{
  assert.match(route,/select\("admin,deactivated_at"\)/);
  assert.match(route,/!player\?\.admin\|\|player\.deactivated_at/);
});

await check("Permanent user deletion stays blocked",()=>{
  assert.match(route,/Permanent sletting er deaktivert/);
  assert.doesNotMatch(route,/auth\.admin\.deleteUser/);
});

await check("Deactivation uses Supabase Auth ban and retains profile/history",()=>{
  assert.match(route,/action===\"deactivate\"/);
  assert.match(route,/ban_duration:\"876000h\"/);
  assert.match(route,/deactivated_at:deactivatedAt/);
  assert.doesNotMatch(route,/\.delete\(\)/);
});

await check("Reactivation unbans Auth and clears only deactivation marker",()=>{
  assert.match(route,/action===\"reactivate\"/);
  assert.match(route,/ban_duration:\"none\"/);
  assert.match(route,/deactivated_at:null/);
});

await check("Last active administrator and self-deactivation are protected",()=>{
  assert.match(route,/Du kan ikke deaktivere din egen administratorkonto/);
  assert.match(route,/Den siste aktive administratoren kan ikke deaktiveres/);
  assert.match(route,/Den siste aktive administratoren kan ikke fjernes/);
  assert.match(route,/\.is\("deactivated_at",null\)/);
});

await check("Sensitive user changes require an audit row or rollback",()=>{
  assert.match(route,/user_admin_audit/);
  assert.match(route,/profile_name_changed/);
  assert.match(route,/admin_role_changed/);
  assert.match(route,/user_deactivated/);
  assert.match(route,/user_reactivated/);
  assert.match(route,/rullet tilbake fordi auditloggen ikke kunne skrives/);
});

await check("Audit table is client-closed",()=>{
  assert.match(sql,/alter table public\.user_admin_audit enable row level security/);
  assert.match(sql,/revoke all on table public\.user_admin_audit from public, anon, authenticated/);
});

await check("AuthGate blocks a still-valid JWT for deactivated accounts",()=>{
  assert.match(authGate,/deactivated_at/);
  assert.match(authGate,/loadedProfile\?\.deactivated_at/);
  assert.match(authGate,/Kontoen er deaktivert/);
  assert.match(authGate,/signOut\(\{ scope: \"local\" \}\)/);
});

await check("Admin UI exposes deactivate/reactivate and audit without hard delete",()=>{
  assert.match(page,/Deaktiver/);
  assert.match(page,/Gjenåpne/);
  assert.match(page,/Auditlogg/);
  assert.doesNotMatch(page,/Slett bruker/);
});

const failed=checks.filter(row=>!row.ok);
if(failed.length){console.error(`\nMP-01 user admin regression failed: ${failed.length}/${checks.length}`);process.exit(1)}
console.log(`\nPASS ${checks.length}/${checks.length} MP-01 user admin lifecycle checks.`);
