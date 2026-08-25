import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cron = await readFile(new URL("../.github/workflows/ehl-sync.yml", import.meta.url), "utf8");
const hockeyLive = await readFile(new URL("../lib/providers/hockeylive.ts", import.meta.url), "utf8");
const syncService = await readFile(new URL("../lib/sync-service.ts", import.meta.url), "utf8");
const triggerHardening = await readFile(new URL("../supabase/mp01_launch_gate_trigger_rpc_hardening_v1.sql", import.meta.url), "utf8");
const tableHardening = await readFile(new URL("../supabase/mp01_launch_gate_service_tables_hardening_v1.sql", import.meta.url), "utf8");

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, ok: false });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

check("Production cron is protected by CRON_SECRET", () => {
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /Authorization: Bearer/);
  assert.match(cron, /stang-inn-xi\.vercel\.app\/api\/sync-ehl/);
});

check("Production cron retries bounded failures", () => {
  assert.match(cron, /--retry 2/);
  assert.match(cron, /--max-time 45/);
});

check("HockeyLive requests have a bounded internal timeout", () => {
  assert.match(hockeyLive, /HOCKEYLIVE_TIMEOUT_MS = 10_000/);
  assert.match(hockeyLive, /AbortSignal\.timeout\(HOCKEYLIVE_TIMEOUT_MS\)/);
});

check("Partial standings or Fantasy failures make the sync fail closed", () => {
  assert.match(syncService, /const operationalErrors: string\[\] = \[\]/);
  assert.match(syncService, /if \(standingsError\)/);
  assert.match(syncService, /if \(fantasyError\)/);
  assert.match(syncService, /fantasyGames\?\.failed/);
  assert.match(syncService, /fantasyAutomation\?\.snapshotErrors/);
  assert.match(syncService, /const syncOk = operationalErrors\.length === 0/);
  assert.match(syncService, /ok: result\.ok/);
  assert.match(syncService, /error_message: result\.error \?\? null/);
});

check("Client roles cannot execute launch-gate trigger helpers directly", () => {
  assert.match(triggerHardening, /capture_fantasy_snapshot_owner_name_v1\(\)/);
  assert.match(triggerHardening, /guard_ep_provisional_nif_insert\(\)/);
  assert.match(triggerHardening, /from public/);
  assert.match(triggerHardening, /from anon/);
  assert.match(triggerHardening, /from authenticated/);
});

check("RLS service-only tables have direct client privileges revoked", () => {
  for (const table of [
    "fantasy_games",
    "fantasy_player_game_stats",
    "fantasy_player_points",
    "fantasy_snapshot_batches",
    "fantasy_stat_snapshots",
    "fantasy_xfp_settings",
    "stang_inn_private_leagues",
    "stang_inn_private_league_members",
  ]) {
    assert.match(tableHardening, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
});

const failed = checks.filter((row) => !row.ok);
if (failed.length) {
  console.error(`\nMP-01 operations regression failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\nPASS ${checks.length}/${checks.length} MP-01 operations checks.`);
