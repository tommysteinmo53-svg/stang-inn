import { createClient } from "@supabase/supabase-js";

type Row = Record<string, any>;
const PUBLIC_ROOT = "https://sf34-terminlister-prod-app.azurewebsites.net";

function first(...values: any[]) { return values.find((v) => v !== undefined && v !== null && v !== "") ?? null; }
function text(v: any) { return v == null ? "" : String(v).trim(); }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function matchIdOf(r: Row) { return num(first(r.matchId, r.MatchId, r.matchID, r.id, r.Id), -1); }
function teamName(r: Row, side: "home"|"away") {
  return side === "home"
    ? text(first(r.hometeamOverriddenName, r.hometeam, r.hometeamOrgName, r.homeTeamName, r.HomeTeamName, r.teamNameHome))
    : text(first(r.awayteamOverriddenName, r.awayteam, r.awayteamOrgName, r.awayTeamName, r.AwayTeamName, r.teamNameAway));
}
function score(r: Row, side: "home"|"away") {
  return side === "home"
    ? first(r.hometeamScore, r.homeTeamScore, r.hometeamGoals, r.homeTeamGoals, r.homeScore, r.HomeScore, r.homeGoals)
    : first(r.awayteamScore, r.awayTeamScore, r.awayteamGoals, r.awayTeamGoals, r.awayScore, r.AwayScore, r.awayGoals);
}
function startTime(r: Row) {
  const direct = first(r.matchStartDate, r.MatchStartDate, r.startDate, r.StartDate, r.dateTime, r.startTimeUtc);
  if (direct) { const d = new Date(String(direct)); if (!Number.isNaN(d.getTime())) return d.toISOString(); }
  const date = text(first(r.matchDate, r.MatchDate, r.date, r.Date)).slice(0,10);
  const clock = text(first(r.matchStartTime, r.MatchStartTime, r.startTime)) || "00:00";
  const d = new Date(`${date}T${clock.length === 5 ? clock : "00:00"}:00+01:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function isFinished(r: Row) {
  const status = num(first(r.statusTypeId, r.StatusTypeId), 0);
  const hs = score(r,"home"), as = score(r,"away");
  return status >= 4 || (hs !== null && hs !== undefined && as !== null && as !== undefined);
}
function serverClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function prepareFantasySeason(tournamentId:string, season:string) {
  const response = await fetch(`${PUBLIC_ROOT}/ta/TournamentMatches/?tournamentId=${encodeURIComponent(tournamentId)}`, {
    headers:{Accept:"application/json", "User-Agent":"StangInn/1.0 fantasy-season-import"}, cache:"no-store"
  });
  if(!response.ok) throw new Error(`TournamentMatches svarte ${response.status}`);
  const payload=await response.json();
  const matches:Row[]=Array.isArray(payload)?payload:payload?.matches??payload?.data?.matches??payload?.data??[];
  const valid=matches.filter((r)=>matchIdOf(r)>0 && teamName(r,"home") && teamName(r,"away"));
  const rows=valid.map((r)=>{
    const hs=score(r,"home"), as=score(r,"away");
    return {
      external_id:`hockeylive:${matchIdOf(r)}`,
      season,
      round_no:num(first(r.round,r.Round,r.roundNumber,r.RoundNumber,r.roundNo),0)||null,
      starts_at:startTime(r),
      home_team:teamName(r,"home"), away_team:teamName(r,"away"),
      home_score:hs==null?null:num(hs), away_score:as==null?null:num(as),
      status:isFinished(r)?"finished":"scheduled", updated_at:new Date().toISOString(),
    };
  });
  const supabase=serverClient();
  if(rows.length){
    const {error}=await supabase.from("fantasy_games").upsert(rows,{onConflict:"external_id"});
    if(error) throw error;
  }
  const finishedIds=valid.filter(isFinished).map(matchIdOf).filter((id)=>id>0);
  return { tournamentId, season, totalMatches:valid.length, finishedMatches:finishedIds.length, matchIds:finishedIds };
}
