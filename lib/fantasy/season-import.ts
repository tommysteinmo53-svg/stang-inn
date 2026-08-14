import { createClient } from "@supabase/supabase-js";

type Row = Record<string, any>;
const PUBLIC_ROOT = "https://sf34-terminlister-prod-app.azurewebsites.net";
const SEASON_IDS:Record<string,string>={"2026/27":"201071","2025/26":"201059"};

function first(...values:any[]){return values.find(v=>v!==undefined&&v!==null&&v!=="")??null}
function text(v:any){return v==null?"":String(v).trim()}
function num(v:any,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function matchIdOf(r:Row){return num(first(r.matchId,r.MatchId,r.matchID,r.match_id,r.id,r.Id),-1)}
function nestedName(v:any){if(typeof v==="string")return text(v);if(!v||typeof v!=="object")return"";return text(first(v.name,v.Name,v.orgName,v.teamName,v.shortName,v.overriddenName))}
function teamName(r:Row,side:"home"|"away"){
 const direct=side==="home"?first(r.hometeamOverriddenName,r.homeTeamOverriddenName,r.hometeam,r.hometeamOrgName,r.homeTeamName,r.HomeTeamName,r.teamNameHome,r.homeTeam):first(r.awayteamOverriddenName,r.awayTeamOverriddenName,r.awayteam,r.awayteamOrgName,r.awayTeamName,r.AwayTeamName,r.teamNameAway,r.awayTeam);
 return nestedName(direct)||text(direct)
}
function score(r:Row,side:"home"|"away"){return side==="home"?first(r.hometeamScore,r.homeTeamScore,r.hometeamGoals,r.homeTeamGoals,r.homeScore,r.HomeScore,r.homeGoals):first(r.awayteamScore,r.awayTeamScore,r.awayteamGoals,r.awayTeamGoals,r.awayScore,r.AwayScore,r.awayGoals)}
function startTime(r:Row){const direct=first(r.matchStartDate,r.MatchStartDate,r.startDate,r.StartDate,r.dateTime,r.startTimeUtc,r.matchDateTime);if(direct){const d=new Date(String(direct));if(!Number.isNaN(d.getTime()))return d.toISOString()}const date=text(first(r.matchDate,r.MatchDate,r.date,r.Date)).slice(0,10);const clock=text(first(r.matchStartTime,r.MatchStartTime,r.startTime))||"00:00";const d=new Date(`${date}T${clock.length===5?clock:"00:00"}:00+01:00`);return Number.isNaN(d.getTime())?null:d.toISOString()}
function roundNo(r:Row){return num(first(r.round,r.Round,r.roundNumber,r.RoundNumber,r.roundNo,r.RoundNo,r.matchRound,r.MatchRound,r.matchRoundNo,r.MatchRoundNo,r.tournamentRound,r.TournamentRound,r.tournamentRoundNo,r.TournamentRoundNo,r.seriesRound,r.SeriesRound),0)||null}
function isFinished(r:Row){const status=num(first(r.statusTypeId,r.StatusTypeId,r.matchStatusTypeId),0);const statusText=text(first(r.status,r.statusName,r.matchStatus)).toLowerCase();const hs=score(r,"home"),as=score(r,"away");return status>=4||statusText.includes("ferdig")||statusText.includes("finished")||(hs!==null&&hs!==undefined&&as!==null&&as!==undefined)}
function isPastFixture(r:Row){const iso=startTime(r);if(!iso)return false;return new Date(iso).getTime()<Date.now()-3*60*60*1000}
function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

function extractMatches(payload:any):Row[]{
 const arrays:Row[][]=[];
 const visit=(value:any,depth:number)=>{if(depth>6||value==null)return;if(Array.isArray(value)){const objects=value.filter(v=>v&&typeof v==="object") as Row[];if(objects.length)arrays.push(objects);for(const v of value.slice(0,5))visit(v,depth+1);return}if(typeof value==="object")for(const v of Object.values(value))visit(v,depth+1)};
 visit(payload,0);
 const scored=arrays.map(rows=>({rows,score:rows.reduce((s,r)=>s+(matchIdOf(r)>0?3:0)+(teamName(r,"home")?2:0)+(teamName(r,"away")?2:0),0)})).sort((a,b)=>b.score-a.score||b.rows.length-a.rows.length);
 return scored[0]?.score>0?scored[0].rows:[];
}

async function fetchTournamentMatches(tournamentId:string,season:string){
 const seasonId=SEASON_IDS[season];
 const urls=[
  seasonId?`${PUBLIC_ROOT}/ta/TournamentMatches/?seasonId=${encodeURIComponent(seasonId)}&tournamentId=${encodeURIComponent(tournamentId)}`:null,
  `${PUBLIC_ROOT}/ta/TournamentMatches/?tournamentId=${encodeURIComponent(tournamentId)}`
 ].filter(Boolean) as string[];
 let lastStatus=0,lastPayload:any=null,lastUrl=urls[urls.length-1];
 for(const url of urls){
  lastUrl=url;
  const response=await fetch(url,{headers:{Accept:"application/json,text/plain,*/*","User-Agent":"StangInn/1.0 fantasy-season-import"},cache:"no-store"});
  lastStatus=response.status;
  if(!response.ok)continue;
  const payload=await response.json();
  lastPayload=payload;
  const matches=extractMatches(payload);
  if(matches.length)return{matches,url,seasonId};
 }
 return{matches:extractMatches(lastPayload),url:lastUrl,seasonId,status:lastStatus};
}

export async function prepareFantasySeason(tournamentId:string,season:string){
 const fetched=await fetchTournamentMatches(tournamentId,season);
 const matches=fetched.matches;
 const valid=matches.filter(r=>matchIdOf(r)>0&&teamName(r,"home")&&teamName(r,"away"));
 if(!valid.length){const sample=matches[0];throw new Error(`Fant 0 gyldige kamper i TournamentMatches for ${season}. seasonId=${fetched.seasonId||"ukjent"}, tournamentId=${tournamentId}, HTTP=${fetched.status||200}. Kandidatrader: ${matches.length}. Felt: ${sample?Object.keys(sample).slice(0,24).join(", "):"ingen"}`)}
 const rows=valid.map(r=>{const hs=score(r,"home"),as=score(r,"away"),iso=startTime(r);return{external_id:`hockeylive:${matchIdOf(r)}`,season,round_no:roundNo(r),starts_at:iso||new Date().toISOString(),home_team:teamName(r,"home"),away_team:teamName(r,"away"),home_score:hs==null?null:num(hs),away_score:as==null?null:num(as),status:isFinished(r)?"finished":"scheduled",updated_at:new Date().toISOString()}});
 const supabase=serverClient();const{error}=await supabase.from("fantasy_games").upsert(rows,{onConflict:"external_id"});if(error)throw error;
 const explicitlyFinished=valid.filter(isFinished).map(matchIdOf).filter(id=>id>0);
 const pastIds=valid.filter(isPastFixture).map(matchIdOf).filter(id=>id>0);
 const seasonYears=String(season).match(/(20\d{2})\s*\/\s*(\d{2,4})/);
 const startYear=seasonYears?Number(seasonYears[1]):null;
 const currentYear=new Date().getFullYear();
 const historicalSeason=startYear!=null&&startYear<currentYear;
 const useHistoricalFallback=historicalSeason&&explicitlyFinished.length===0;
 const matchIds=[...new Set(useHistoricalFallback?pastIds:explicitlyFinished)];
 const roundValues=[...new Set(valid.map(roundNo).filter((v):v is number=>v!=null))].sort((a,b)=>a-b);
 return{tournamentId,season,seasonId:fetched.seasonId,sourceUrl:fetched.url,totalMatches:valid.length,matchesWithRoundNo:valid.filter(r=>roundNo(r)!=null).length,roundValues,finishedMatches:explicitlyFinished.length,pastMatches:pastIds.length,usedHistoricalFallback:useHistoricalFallback,matchIds,sourceRows:matches.length,sampleFields:Object.keys(matches[0]||{}).slice(0,32)}
}
