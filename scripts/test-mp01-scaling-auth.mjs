import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const login=read("app/login/page.tsx");
const authGate=read("components/AuthGate.tsx");
const home=read("components/UnifiedHomeDashboard.tsx");
const sql=read("supabase/mp01-scaling-tipping-home-summary-v1.sql");

const checks=[
 ["Login uses Google OAuth",login.includes('provider: "google"')&&login.includes("signInWithOAuth")],
 ["Email OTP login is absent",!login.includes("signInWithOtp")&&!login.includes("Logg inn med e-post")&&!login.includes("Send innloggingslenke")],
 ["AuthGate rejects non-Google sessions",authGate.includes("hasGoogleIdentity")&&authGate.includes("google_required")&&authGate.includes('signOut({ scope: "local" })')],
 ["Homepage uses lightweight tipping summary RPC",home.includes('rpc("get_my_tipping_home_summary_v1")')],
 ["Homepage no longer stores global tips or players",!home.includes("allTips")&&!home.includes("setAllTips")&&!home.includes("setPlayers")],
 ["Homepage no longer performs unscoped tips query",!home.includes('sb.from("tips").select("player_id,match_id,home_tip,away_tip,points"),')],
 ["Tipping summary excludes deactivated users",sql.includes("where p.deactivated_at is null")],
 ["Tipping summary is authenticated-only",sql.includes("revoke all on function public.get_my_tipping_home_summary_v1() from public, anon")&&sql.includes("grant execute on function public.get_my_tipping_home_summary_v1() to authenticated")],
];

let failed=0;
for(const[name,ok]of checks){
 console.log(`${ok?"PASS":"FAIL"} ${name}`);
 if(!ok)failed++;
}
if(failed){console.error(`MP-01 scaling/auth regression failed: ${failed} contract(s)`);process.exit(1)}
console.log(`MP-01 scaling/auth regression passed: ${checks.length}/${checks.length}`);
