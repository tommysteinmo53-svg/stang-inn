export async function verifiedShootoutGoalGap(matchId: number, goals: Record<string,any>[], homeScore: number, awayScore: number): Promise<boolean> {
  if (Math.abs(homeScore-awayScore)!==1 || goals.length!==homeScore+awayScore-1) return false;
  const url="https://sf34-terminlister-prod-app.azurewebsites.net/ta/TournamentMatches/?tournamentId="+encodeURIComponent(process.env.HOCKEYLIVE_TOURNAMENT_ID||"448981");
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(10000)});
  if (!response.ok) return false;
  const payload=await response.json();
  const rows=Array.isArray(payload)?payload:payload?.matches??payload?.data?.matches??[];
  const match=rows.find((r:any)=>Number(r.matchId??r.MatchId??r.id)===matchId);
  if (!match) return false;
  const result=match.matchResult??{};
  const labels=[match.matchStatus,match.statusText,match.matchStatusText,match.resultType,match.resultTypeName,match.decisionType,match.decisionTypeName,result.resultType,result.resultTypeName,result.decisionType,result.decisionTypeName,result.matchEndType].filter((v:any)=>typeof v==="string").join(" ").toLowerCase();
  const explicit=[match.isShootout,match.shootout,match.penaltyShootout,result.isShootout,result.shootout].some(v=>v===true)||/shoot.?out|straffe|penalt/.test(labels);
  if (!explicit) return false;
  const end=String(result.matchEndResult??"").match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!end || Number(end[1])!==Number(end[2])) return false;
  if (Number(result.homeGoals)!==homeScore || Number(result.awayGoals)!==awayScore) return false;
  return Number(end[1])+Number(end[2])===goals.length;
}
