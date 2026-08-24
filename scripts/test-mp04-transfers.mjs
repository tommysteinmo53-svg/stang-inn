import fs from "node:fs";

const read=p=>fs.readFileSync(p,"utf8");
const rules=read("docs/FANTASY_TRANSFER_RULES.md");
const transferSql=read("supabase/mp07-transfer-boost-v1.sql");
const isolatedTransfer=read("supabase/mp12-isolated-transfer-e2e-v1.sql");
const historySql=read("supabase/mp04-transfer-history-v1.sql");
const teamNameSql=read("supabase/mp04-required-team-name-v1.sql");
const historyPage=read("app/fantasy/transfers/page.tsx");
const teamPage=read("app/fantasy/team/page.tsx");
const nav=read("app/fantasy/FantasyNav.tsx");

const checks=[
 ["rules: 2 transfers",/maks 2 permanente spillerbytter/.test(rules)],
 ["rules: no bank",/spares ikke/.test(rules)],
 ["rules: no points hits",/ingen ekstra bytter mot poengtrekk/.test(rules)],
 ["rules: save commits",/teller først når brukeren \*\*lagrer\*\*/.test(rules)],
 ["rules: lineup captain vice free",/rekke 1 \/ rekke 2/.test(rules)&&/kaptein/.test(rules)&&/visekaptein/.test(rules)],
 ["server: event-week block",/Permanent transfers are disabled during an Event Week/.test(transferSql)],
 ["server: bytteboost max 4",/v_limit:=4/.test(transferSql)],
 ["server: bytteboost commits after 2",/v_new_used>2/.test(transferSql)&&/status='committed'/.test(transferSql)],
 ["server: deadline uses next open round",/deadline_at>now\(\)/.test(transferSql)],
 ["server: snapshot gate",/fantasy_team_round_snapshots/.test(transferSql)],
 ["isolated E2E: ordinary clients remain hard-locked to 2026/27",/p_season<>'2026\/27'/.test(isolatedTransfer)],
 ["isolated E2E: synthetic season requires service role",/v_role='service_role'/.test(isolatedTransfer)&&/p_season like '__e2e_%'/.test(isolatedTransfer)],
 ["isolated E2E: test namespace is synthetic",/__e2e_mp12_transfers__/.test(isolatedTransfer)],
 ["isolated E2E: exercises real transfer RPC",/apply_fantasy_transfers_v1\(v_season/.test(isolatedTransfer)],
 ["isolated E2E: validates ordinary and boosted limits",/Three transfers are blocked without Bytteboost/.test(isolatedTransfer)&&/Bytteboost allows cumulative four/.test(isolatedTransfer)],
 ["isolated E2E: validates transfer ledger",/fantasy_transfer_items/.test(isolatedTransfer)&&/direction='in'/.test(isolatedTransfer)&&/direction='out'/.test(isolatedTransfer)],
 ["isolated E2E: cleans synthetic season",/Synthetic transfer fixtures cleaned/.test(isolatedTransfer)],
 ["history RPC authenticated",/auth\.uid\(\)/.test(historySql)&&/security definer/.test(historySql)],
 ["history contains IN and OUT",/direction='out'/.test(historySql)&&/direction='in'/.test(historySql)],
 ["history excludes event-team tables",!/fantasy_event_team_players/.test(historySql)],
 ["UI explains no bank",/Ubrukte bytter spares ikke/.test(historyPage)],
 ["UI explains saved transfers",/Lagre = gjennomført/.test(historyPage)],
 ["UI has history",/Historikk/.test(historyPage)&&/get_my_fantasy_transfer_history_v1/.test(historyPage)],
 ["navigation exposes transfers",/\/fantasy\/transfers/.test(nav)],
 ["team name server validation exists",/normalize_fantasy_team_name_v1/.test(teamNameSql)&&/fantasy_user_teams_require_name_v1/.test(teamNameSql)],
 ["team name placeholders rejected",/mitt lag/.test(teamNameSql)&&/my team/.test(teamNameSql)&&/Choose a personal Fantasy team name/.test(teamNameSql)],
 ["team name length enforced server-side",/char_length\(v_name\) < 3/.test(teamNameSql)&&/char_length\(v_name\) > 40/.test(teamNameSql)],
 ["team rename is authenticated-only",/rename_fantasy_team_v1/.test(teamNameSql)&&/grant execute on function rename_fantasy_team_v1\(text,text\) to authenticated/.test(teamNameSql)&&/revoke all on function rename_fantasy_team_v1\(text,text\) from anon/.test(teamNameSql)],
 ["team rename only updates team name",/set name=v_name,updated_at=now\(\)/.test(teamNameSql)&&!/fantasy_user_team_players/.test(teamNameSql)&&!/fantasy_transfer_batches/.test(teamNameSql)],
 ["builder does not default to Mitt lag",/useState\(""\)/.test(teamPage)&&!/setTeamName\(t\.name\|\|"Mitt lag"\)/.test(teamPage)],
 ["builder validates name before team save",/const valid=rosterValid&&nameValid&&!nameNeedsCompletion/.test(teamPage)],
 ["builder supports safe completion rename",/nameNeedsCompletion/.test(teamPage)&&/rename_fantasy_team_v1/.test(teamPage)&&/Lagre lagnavn/.test(teamPage)],
 ["builder explains rename is not transfer",/lagnavn teller ikke som spillerbytte/.test(teamPage)&&/dette brukte ingen bytter/.test(teamPage)],
];

const failed=checks.filter(([,ok])=>!ok);
for(const[name,ok]of checks)console.log(`${ok?"PASS":"FAIL"} ${name}`);
if(failed.length){console.error(`\n${failed.length} MP-04 transfer/team-name contract checks failed.`);process.exit(1)}
console.log(`\nPASS ${checks.length}/${checks.length} MP-04 transfer/team-name contract checks.`);
