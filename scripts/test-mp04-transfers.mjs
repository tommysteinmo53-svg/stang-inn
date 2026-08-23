import fs from "node:fs";

const read=p=>fs.readFileSync(p,"utf8");
const rules=read("docs/FANTASY_TRANSFER_RULES.md");
const transferSql=read("supabase/mp07-transfer-boost-v1.sql");
const historySql=read("supabase/mp04-transfer-history-v1.sql");
const historyPage=read("app/fantasy/transfers/page.tsx");
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
 ["history RPC authenticated",/auth\.uid\(\)/.test(historySql)&&/security definer/.test(historySql)],
 ["history contains IN and OUT",/direction='out'/.test(historySql)&&/direction='in'/.test(historySql)],
 ["history excludes event-team tables",!/fantasy_event_team_players/.test(historySql)],
 ["UI explains no bank",/Ubrukte bytter spares ikke/.test(historyPage)],
 ["UI explains saved transfers",/Lagre = gjennomført/.test(historyPage)],
 ["UI has history",/Historikk/.test(historyPage)&&/get_my_fantasy_transfer_history_v1/.test(historyPage)],
 ["navigation exposes transfers",/\/fantasy\/transfers/.test(nav)],
];

const failed=checks.filter(([,ok])=>!ok);
for(const[name,ok]of checks)console.log(`${ok?"PASS":"FAIL"} ${name}`);
if(failed.length){console.error(`\n${failed.length} MP-04 transfer contract checks failed.`);process.exit(1)}
console.log(`\nPASS ${checks.length}/${checks.length} MP-04 transfer contract checks.`);
