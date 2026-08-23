import fs from "node:fs";

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const rpc=read("supabase/mp07-round-history-snapshot-first-v1.sql");
const snapshot=read("supabase/mp07-round-history-snapshot-name-v1.sql");
const page=read("app/fantasy/my-rounds/page.tsx");
const view=read("app/fantasy/my-rounds/RoundPointsView.tsx");

const checks=[
 ["snapshot freezes player name",snapshot.includes("player_name")&&snapshot.includes("before insert")&&snapshot.includes("set not null")],
 ["history RPC starts from snapshots",rpc.includes("from public.fantasy_team_round_snapshots s")&&rpc.includes("join public.fantasy_team_round_snapshot_players sp")],
 ["score is optional left-joined context",rpc.includes("left join public.fantasy_team_round_points trp")&&rpc.includes("left join public.fantasy_team_round_player_points prp")],
 ["snapshot identity fields drive roster",rpc.includes("sp.player_name")&&rpc.includes("sp.position")&&rpc.includes("sp.team")&&rpc.includes("sp.price")&&rpc.includes("sp.line_no")],
 ["current team table never reconstructs history",!rpc.includes("fantasy_user_team_players")],
 ["transfer ledger is context only",rpc.includes("transfer_by_round")&&rpc.includes("left join transfer_by_round")],
 ["event rounds hide permanent transfers",rpc.includes("case when s.event_type is null then coalesce(tbr.transfer_count,0) else 0 end")],
 ["personal RPC blocks anon",rpc.includes("revoke execute on function public.get_my_fantasy_round_history_v1(text,uuid) from anon")],
 ["page uses snapshot-first RPC",page.includes('rpc("get_my_fantasy_round_history_v1"')&&!page.includes("get_my_fantasy_round_details_v2")],
 ["UI shows both frozen lines",view.includes("renderLine(1)")&&view.includes("renderLine(2)")],
 ["UI handles unscored locked snapshots",view.includes("Laget er fryst og kan vises allerede nå")&&view.includes('current.is_scored?')],
 ["UI explains immutable history",view.includes("påvirkes ikke av senere transfers eller lagendringer")],
];

let failed=0;
for(const[name,ok]of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)failed++}
if(failed){console.error(`MP-07.7 round-history regression failed: ${failed}/${checks.length}`);process.exit(1)}
console.log(`MP-07.7 round-history regression PASS: ${checks.length}/${checks.length}`);
