import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const login=read("app/login/page.tsx");
const authGate=read("components/AuthGate.tsx");
const home=read("components/UnifiedHomeDashboard.tsx");
const leaderboard=read("app/leaderboard/page.tsx");
const fantasyLeaderboard=read("app/fantasy/leaderboard/page.tsx");
const homeSql=read("supabase/mp01-scaling-tipping-home-summary-v1.sql");
const leaderboardSql=read("supabase/mp01-scaling-tipping-leaderboard-v2.sql");
const fantasyHomeSql=read("supabase/mp01-scaling-fantasy-home-summary-v1.sql");
const cacheSql=read("supabase/mp01-scaling-competition-cache-v1.sql");

const checks=[
 ["Login uses Google OAuth",login.includes('provider: "google"')&&login.includes("signInWithOAuth")],
 ["Email OTP login is absent",!login.includes("signInWithOtp")&&!login.includes("Logg inn med e-post")&&!login.includes("Send innloggingslenke")],
 ["AuthGate rejects non-Google sessions",authGate.includes("hasGoogleIdentity")&&authGate.includes("google_required")&&authGate.includes('signOut({ scope: "local" })')],
 ["Homepage uses lightweight tipping summary RPC",home.includes('rpc("get_my_tipping_home_summary_v1")')],
 ["Homepage no longer stores global tips or players",!home.includes("allTips")&&!home.includes("setAllTips")&&!home.includes("setPlayers")],
 ["Homepage scopes schedule to five future unfinished matches",home.includes('.eq("finished",false).gte("match_time",nowIso).order("match_time").limit(5)')],
 ["Homepage scopes user tips to displayed match ids",home.includes('.eq("player_id",user.id).in("match_id",matchIds.length?matchIds:[-1])')],
 ["Tipping homepage summary excludes deactivated users",homeSql.includes("where p.deactivated_at is null")],
 ["Tipping homepage summary is authenticated-only",homeSql.includes("revoke all on function public.get_my_tipping_home_summary_v1() from public, anon")&&homeSql.includes("grant execute on function public.get_my_tipping_home_summary_v1() to authenticated")],
 ["Homepage uses lightweight fantasy summary RPC",home.includes('rpc("get_my_fantasy_home_summary_v1",{p_season:SEASON})')],
 ["Homepage no longer downloads full fantasy season leaderboard",!home.includes('rpc("get_fantasy_season_leaderboard"')],
 ["Fantasy homepage summary excludes deactivated users",fantasyHomeSql.includes("p.deactivated_at is null")],
 ["Fantasy homepage summary preserves MP-07 tie-break",fantasyHomeSql.includes("at.total_points desc")&&fantasyHomeSql.includes("at.round_wins desc")&&fantasyHomeSql.includes("at.best_round_points desc")],
 ["Fantasy homepage summary is authenticated-only",fantasyHomeSql.includes("from public, anon")&&fantasyHomeSql.includes("to authenticated")&&fantasyHomeSql.includes("auth.uid()")],
 ["Leaderboard uses server-side RPC",leaderboard.includes('rpc("get_tipping_leaderboard_v1")')],
 ["Leaderboard no longer downloads all tips",!leaderboard.includes('.from("tips")')&&!leaderboard.includes("home_tip")&&!leaderboard.includes("away_tip")],
 ["Leaderboard no longer downloads players",!leaderboard.includes('.from("players")')],
 ["Leaderboard polls only lightweight match status",leaderboard.includes('.from("matches").select("id,finished,match_time")')],
 ["Leaderboard SQL excludes deactivated users",leaderboardSql.includes("where p.deactivated_at is null")],
 ["Leaderboard RPC is authenticated-only",leaderboardSql.includes("revoke all on function public.get_tipping_leaderboard_v1() from public, anon")&&leaderboardSql.includes("grant execute on function public.get_tipping_leaderboard_v1() to authenticated")],
 ["Leaderboard avoids player x match cross join",!leaderboardSql.includes("cross join finished_matches")&&!leaderboardSql.includes("cross join finished_matches fm")],
 ["Leaderboard streaks preserve contiguous match semantics",leaderboardSql.includes("rt.match_no - row_number()")&&leaderboardSql.includes("run_end = (select max_match_no from max_match)")],
 ["Fantasy leaderboard uses competition v2 RPC",fantasyLeaderboard.includes('rpc("get_fantasy_competition_table_v2",{p_season:SEASON})')],
 ["Competition cache tables deny direct client grants",cacheSql.includes("revoke all on table public.tipping_leaderboard_cache from public, anon, authenticated")&&cacheSql.includes("revoke all on table public.fantasy_season_leaderboard_cache from public, anon, authenticated")],
 ["Competition cache tables have RLS",cacheSql.includes("alter table public.tipping_leaderboard_cache enable row level security")&&cacheSql.includes("alter table public.fantasy_season_leaderboard_cache enable row level security")],
 ["Cache refresh is service-role only",cacheSql.includes("grant execute on function public.refresh_tipping_leaderboard_cache_v1() to service_role")&&cacheSql.includes("grant execute on function public.refresh_fantasy_season_leaderboard_cache_v1(text) to service_role")&&cacheSql.includes("revoke all on function public.refresh_tipping_leaderboard_cache_v1() from public, anon, authenticated")],
 ["Cached reads filter deactivated users live",(cacheSql.match(/p\.deactivated_at is null/g)||[]).length>=3],
 ["Cached Fantasy read preserves MP-07 tie-break",cacheSql.includes("a.total_points desc")&&cacheSql.includes("a.round_wins desc")&&cacheSql.includes("a.best_round_points desc")],
 ["Cached Fantasy competition preserves movement inputs",cacheSql.includes("previous_total")&&cacheSql.includes("previous_round_wins")&&cacheSql.includes("previous_best_round_points")&&cacheSql.includes("previous_standings_position")],
 ["Cached Fantasy competition preserves current identity",cacheSql.includes("t.name::text as team_name")&&cacheSql.includes("p.profile_name_confirmed_at is not null")&&cacheSql.includes("'Ukjent spiller'")],
 ["Cached read RPCs stay authenticated-only",cacheSql.includes("grant execute on function public.get_tipping_leaderboard_v1() to authenticated")&&cacheSql.includes("grant execute on function public.get_my_tipping_home_summary_v1() to authenticated")&&cacheSql.includes("grant execute on function public.get_my_fantasy_home_summary_v1(text) to authenticated")&&cacheSql.includes("grant execute on function public.get_fantasy_competition_table_v2(text) to authenticated")],
];

let failed=0;
for(const[name,ok]of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)failed++}
if(failed){console.error(`MP-01 scaling/auth regression failed: ${failed} contract(s)`);process.exit(1)}
console.log(`MP-01 scaling/auth regression passed: ${checks.length}/${checks.length}`);
