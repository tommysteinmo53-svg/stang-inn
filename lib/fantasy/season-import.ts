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
function osloLocalToIso(date:string,clock:string){
 const dm=date.match(/(20\d{2})-(\d{2})-(\d{2})/),tm=clock.match(/(\d{1,2}):(\d{2})/);if(!dm||!tm)return null;
 const y=Number(dm[1]),mo=Number(dm[2]),d=Number(dm[3]),h=Number(tm[1]),mi=Number(tm[2]);
 const wallUtc=Date.UTC(y,mo-1,d,h,mi,0);
 const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Oslo",hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
 const parts=Object.fromEntries(fmt.formatToParts(new Date(wallUtc)).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour)%24,Number(parts.minute),Number(parts.second));
 const offset=represented-wallUtc;
 return new Date(wallUtc-offset).toISOString();
}
function startTime(r:Row){
 const dateSource=text(first(r.matchDate,r.MatchDate,r.date,r.Date,r.matchStartDate,r.MatchStartDate,r.startDate,r.StartDate));
 const clock=text(first(r.matchStartTime,r.MatchStartTime,r.startTime,r.StartTime,r.time,r.Time));
 if(dateSource&&clock){const local=osloLocalToIso(dateSource.slice(0,10),clock);if(local)return local}
 const direct=first(r.dateTime,r.startTimeUtc,r.matchDateTime,r.matchStartDate,r.MatchStartDate,r.startDate,r.StartDate);
 if(direct){const d=new Date(String(direct));if(!Number.isNaN(d.getTime()))return d.toISOString()}
 return null
}
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
 const urls=[seasonId?`${PUBLIC_ROOT}/ta/TournamentMatches/?seasonId=${encodeURIComponent(seasonId)}&tournamentId=${encodeURIComponent(tournamentId)}`:null,`${PUBLIC_ROOT}/ta/TournamentMatches/?tournamentId=${encodeURIComponent(tournamentId)}`].filter(Boolean) as string[];
 let lastStatus=0,lastPayload:any=null,lastUrl=urls[urls.length-1];
 for(const url of urls){lastUrl=url;const response=await fetch(url,{headers:{Accept:"application/json,text/plain,*/*","User-Agent":"StangInn/1.0 fantasy-season-import"},cache:"no-store"});lastStatus=response.status;if(!response.ok)continue;const payload=await response.json();lastPayload=payload;const matches=extractMatches(payload);if(matches.length)return{matches,url,seasonId};}
 return{matches:extractMatches(lastPayload),url:lastUrl,seasonId,status:lastStatus};
}

function deriveRounds(matches:Row[]){
 const ordered=[...matches].sort((a,b)=>new Date(startTime(a)||0).getTime()-new Date(startTime(b)||0).getTime()||matchIdOf(a)-matchIdOf(b));
 const teams=[...new Set(ordered.flatMap(r=>[teamName(r,"home"),teamName(r,"away")]).filter(Boolean))];
 if(teams.length!==10||ordered.length%5!==0)throw new Error(`Kan ikke utlede runder sikkert: ${teams.length} lag og ${ordered.length} kamper (forventet 10 lag og antall kamper delelig på 5).`);
 const remaining=[...ordered],assigned=new Map<number,number>(),roundSummaries:any[]=[];
 const findRound=(pool:Row[])=>{if(pool.length<5)return null;const anchor=pool[0],used=new Set([teamName(anchor,"home"),teamName(anchor,"away")]),chosen=[anchor];const search=(from:number):Row[]|null=>{if(chosen.length===5)return used.size===10?[...chosen]:null;for(let i=from;i<Math.min(pool.length,24);i++){const g=pool[i],h=teamName(g,"home"),a=teamName(g,"away");if(!h||!a||used.has(h)||used.has(a))continue;used.add(h);used.add(a);chosen.push(g);const result=search(i+1);if(result)return result;chosen.pop();used.delete(h);used.delete(a)}return null};return search(1)};
 let round=1;
 while(remaining.length){const group=findRound(remaining);if(!group){const g=remaining[0];throw new Error(`Kunne ikke utlede runde ${round} sikkert rundt ${teamName(g,"home")}–${teamName(g,"away")} (${startTime(g)||"ukjent tid"}). Terminlisten må kontrolleres manuelt.`)}const ids=new Set(group.map(matchIdOf));for(const g of group)assigned.set(matchIdOf(g),round);const times=group.map(g=>new Date(startTime(g)||0).getTime()).filter(Number.isFinite);roundSummaries.push({round,matchIds:group.map(matchIdOf),firstStart:new Date(Math.min(...times)).toISOString(),lastStart:new Date(Math.max(...times)).toISOString()});for(let i=remaining.length-1;i>=0;i--)if(ids.has(matchIdOf(remaining[i])))remaining.splice(i,1);remaining.sort((a,b)=>new Date(startTime(a)||0).getTime()-new Date(startTime(b)||0).getTime()||matchIdOf(a)-matchIdOf(b));round++}
 if(roundSummaries.some(r=>r.matchIds.length!==5))throw new Error("Rundeutledning feilet: minst én runde har ikke 5 kamper.");return{assigned,roundSummaries,teams};
}

export async function prepareFantasySeason(tournamentId:string,season:string){
 const fetched=await fetchTournamentMatches(tournamentId,season),matches=fetched.matches;
 const valid=matches.filter(r=>matchIdOf(r)>0&&teamName(r,"home")&&teamName(r,"away"));
 if(!valid.length){const sample=matches[0];throw new Error(`Fant 0 gyldige kamper i TournamentMatches for ${season}. seasonId=${fetched.seasonId||"ukjent"}, tournamentId=${tournamentId}, HTTP=${fetched.status||200}. Kandidatrader: ${matches.length}. Felt: ${sample?Object.keys(sample).slice(0,24).join(", "):"ingen"}`)}
 const nativeRoundCount=valid.filter(r=>roundNo(r)!=null).length;let derived:ReturnType<typeof deriveRounds>|null=null;if(nativeRoundCount===0&&season==="2026/27")derived=deriveRounds(valid);
 const rows=valid.map(r=>{const hs=score(r,"home"),as=score(r,"away"),iso=startTime(r);return{external_id:`hockeylive:${matchIdOf(r)}`,season,round_no:roundNo(r)??derived?.assigned.get(matchIdOf(r))??null,starts_at:iso||new Date().toISOString(),home_team:teamName(r,"home"),away_team:teamName(r,"away"),home_score:hs==null?null:num(hs),away_score:as==null?null:num(as),status:isFinished(r)?"finished":"scheduled",updated_at:new Date().toISOString()}});
 const supabase=serverClient();const{error}=await supabase.from("fantasy_games").upsert(rows,{onConflict:"external_id"});if(error)throw error;
 const explicitlyFinished=valid.filter(isFinished).map(matchIdOf).filter(id=>id>0),pastIds=valid.filter(isPastFixture).map(matchIdOf).filter(id=>id>0);
 const seasonYears=String(season).match(/(20\d{2})\s*\/\s*(\d{2,4})/),startYear=seasonYears?Number(seasonYears[1]):null,currentYear=new Date().getFullYear(),historicalSeason=startYear!=null&&startYear<currentYear,useHistoricalFallback=historicalSeason&&explicitlyFinished.length===0,matchIds=[...new Set(useHistoricalFallback?pastIds:explicitlyFinished)];
 const savedRoundValues=[...new Set(rows.map(r=>r.round_no).filter((v):v is number=>v!=null))].sort((a,b)=>a-b);
 return{tournamentId,season,seasonId:fetched.seasonId,sourceUrl:fetched.url,totalMatches:valid.length,matchesWithRoundNo:rows.filter(r=>r.round_no!=null).length,nativeMatchesWithRoundNo:nativeRoundCount,roundsDerived:Boolean(derived),derivedRoundCount:derived?.roundSummaries.length??0,roundValues:savedRoundValues,finishedMatches:explicitlyFinished.length,pastMatches:pastIds.length,usedHistoricalFallback:useHistoricalFallback,matchIds,sourceRows:matches.length,sampleFields:Object.keys(matches[0]||{}).slice(0,32),sampleStartFields:valid.slice(0,3).map(r=>({matchId:matchIdOf(r),matchDate:first(r.matchDate,r.MatchDate,r.date,r.Date),matchStartDate:first(r.matchStartDate,r.MatchStartDate,r.startDate,r.StartDate),matchStartTime:first(r.matchStartTime,r.MatchStartTime,r.startTime,r.StartTime,r.time,r.Time),parsed:startTime(r)}))}
}
