import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const login=read("app/login/page.tsx");
const authGate=read("components/AuthGate.tsx");
const home=read("components/UnifiedHomeDashboard.tsx");
const leaderboard=read("app/leaderboard/page.tsx");
const homeSql=read("supabase/mp01-scaling-tipping-home-summary-v1.sql");
const leaderboardSql=read("supabase/mp01-scaling-tipping-leaderboard-v1.sql");

const checks=[
 ["Login uses Google OAuth",login.includes('provider: "google"')&&login.includes("signInWithOAuth")],
 ["Email OTP login is absent",!login.includes("signInWithOtp")&&!login.includes("Logg inn med e-post")&&!login.includes("Send innloggingslenke")],
 ["AuthGate rejects non-Google sessions",authGate.includes("hasGoogleIdentity")&&authGate.includes("google_required")&&authGate.includes('signOut({ scope: "local" })')],
 ["Homepage uses lightweight tipping summary RPC",home.includes('rpc("get_my_tipping_home_summary_v1")')],
 ["Homepage no longer stores global tips or players",!home.includes("allTips")&&!home.includes("setAllTips")&&!home.includes("setPlayers")],
 ["Homepage no longer performs unscoped tips query",!home.includes('sb.from("tips").select("player_id,match_id,home_tip,away_tip,points"),')],
 ["Homepage summary excludes deactivated users",homeSql.includes("where p.deactivated_at is null")],
 ["Homepage summary is authenticated-only",homeSql.includes("revoke all on function public.get_my_tipping_home_summary_v1() from public, anon")&&homeSql.includes("grant execute on function public.get_my_tipping_home_summary_v1() to authenticated")],
 ["Leaderboard uses server-side RPC",leaderboard.includes('rpc("get_tipping_leaderboard_v1")')],
 ["Leaderboard no longer downloads all tips",!leaderboard.includes('.from("tips")')&&!leaderboard.includes("home_tip")&&!leaderboard.includes("away_tip")],
 ["Leaderboard no longer downloads players",!leaderboard.includes('.from("players")')],
 ["Leaderboard polls only lightweight match status",leaderboard.includes('.from("matches").select("id,finished,match_time")')],
 ["Leaderboard SQL excludes deactivated users",leaderboardSql.includes("where p.deactivated_at is null")],
 ["Leaderboard RPC is authenticated-only",leaderboardSql.includes("revoke all on function public.get_tipping_leaderboard_v1() from public, anon")&&leaderboardSql.includes("grant execute on function public.get_tipping_leaderboard_v1() to authenticated")],
];

let failed=0;
for(const[name,ok]of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)failed++}
if(failed){console.error(`MP-01 scaling/auth regression failed: ${failed} contract(s)`);process.exit(1)}
console.log(`MP-01 scaling/auth regression passed: ${checks.length}/${checks.length}`);
