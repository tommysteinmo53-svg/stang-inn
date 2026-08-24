import fs from "node:fs";

const migration=fs.readFileSync("supabase/mp07-10-fantasy-team-owner-identity.sql","utf8");
const page=fs.readFileSync("app/fantasy/leaderboard/page.tsx","utf8");
const css=fs.readFileSync("app/fantasy/leaderboard/leaderboard.css","utf8");

const checks=[
 [migration.includes("owner_name text")&&migration.includes("capture_fantasy_snapshot_owner_name_v1"),"snapshot must freeze owner_name"],
 [migration.includes("profile_name_confirmed_at is not null"),"snapshot/current identity must use confirmed Stang Inn profile name"],
 [migration.includes("get_fantasy_competition_table_v2")&&migration.includes("get_fantasy_round_leaderboard_v2")&&migration.includes("get_fantasy_monthly_leaderboard_v2")&&migration.includes("get_fantasy_team_season_history_v3"),"competition read models must expose owner identity"],
 [migration.includes("dense_rank() over(order by teams.total_points desc,teams.round_wins desc,teams.best_round_points desc)"),"season ranking/tie-break expression must remain unchanged"],
 [migration.includes("dense_rank() over(order by trp.total_points desc)"),"round ranking expression must remain unchanged"],
 [migration.includes("snap.team_name")&&migration.includes("snap.owner_name"),"monthly historical identity must come from snapshots"],
 [!migration.includes("p.email")&&!migration.includes("players.email"),"competition identity must never expose email"],
 [migration.includes("revoke all on function public.get_fantasy_competition_table_v2")&&migration.includes("to authenticated"),"new identity RPCs must be authenticated-only"],
 [page.includes('get_fantasy_competition_table_v2')&&page.includes('get_fantasy_monthly_leaderboard_v2')&&page.includes('get_fantasy_team_season_history_v3'),"leaderboard UI must consume identity-aware RPCs"],
 [page.includes("owner_name")&&page.includes("Lag / eier"),"leaderboard UI must show both team and owner names"],
 [page.includes("leaderboard-history-identity"),"historical round UI must show snapshot identity"],
 [css.includes(".leaderboard-owner")&&css.includes(".leaderboard-history-identity"),"owner identity must have responsive presentation styles"]
];
let failed=0;
for(const[ok,msg]of checks){console.log(`${ok?'PASS':'FAIL'} ${msg}`);if(!ok)failed++}
if(failed)process.exit(1);
