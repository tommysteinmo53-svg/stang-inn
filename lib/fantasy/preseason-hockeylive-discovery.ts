import {createClient} from "@supabase/supabase-js";

const SEASON_ID=201071;
const PRIMARY_PRESEASON_TOURNAMENT_ID=448939;
const TOURNAMENT_API_BASE="https://sf34-terminlister-prod-app.azurewebsites.net/";

const KNOWN_PRESEASON_MATCHES=[
 {gameDate:"2026-08-15",home:"nidaros",away:"ringerike",matchId:8450777,tournamentId:448939},
 {gameDate:"2026-08-16",home:"nidaros",away:"ringerike",matchId:8450778,tournamentId:448939},
] as const;

type Row=Record<string,any>;
type DbGame={id:number;game_date:string;starts_at:string|null;home_team:string;away_team:string;hockeylive_match_id:number|null;source_type:string|null;notes:string|null};
type TournamentCandidate={matchId:number;gameDate:string;homeTeam:string;awayTeam:string;tournamentId:number};

function serverClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error("Supabase server-variabler mangler");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function first(...values:any[]){return values.find(v=>v!==undefined&&v!==null&&v!=="")??null}
function ascii(v:unknown){return String(v??"").trim().toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function norm(v:unknown){return ascii(v).replace(/[^a-z0-9]+/g,"")}
function teamKey(v:unknown){
 const s=ascii(v);
 if(s.includes("nidaros"))return"nidaros";
 if(s.includes("lorenskog"))return"lorenskog";
 if(s.includes("storhamar"))return"storhamar";
 if(s.includes("stavanger")||s.includes("oilers"))return"oilers";
 if(s.includes("valerenga")||s.includes("vaalerenga"))return"valerenga";
 if(s.includes("frisk"))return"frisk";
 if(s.includes("sparta"))return"sparta";
 if(s.includes("narvik"))return"narvik";
 if(s.includes("stjernen"))return"stjernen";
 if(s.includes("lillehammer"))return"lillehammer";
 if(s.includes("ringerike"))return"ringerike";
 if(s.includes("comet"))return"comet";
 if(s.includes("gjovik"))return"gjovik";
 if(s.includes("manglerud"))return"manglerud";
 if(s.includes("gruner"))return"gruner";
 if(s.includes("ski"))return"ski";
 if(s.includes("kongsvinger"))return"kongsvinger";
 return norm(v);
}
function nestedTeamName(value:any){
 if(!value)return null;
 if(typeof value==="string")return value;
 return first(value.name,value.teamName,value.shortName,value.clubName,value.orgName);
}
function rowDate(raw:Row){
 const value=first(raw.matchDate,raw.MatchDate,raw.matchStartDate,raw.MatchStartDate,raw.startDate,raw.StartDate,raw.date,raw.Date,raw.dateTime);
 if(!value)return null;
 const text=String(value);
 const iso=text.match(/(\d{4}-\d{2}-\d{2})/);
 if(iso)return iso[1];
 const parsed=new Date(text);
 if(Number.isNaN(parsed.getTime()))return null;
 return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth()+1).padStart(2,"0")}-${String(parsed.getUTCDate()).padStart(2,"0")}`;
}
function rowHome(raw:Row){return first(raw.hometeamOverriddenName,raw.hometeam,raw.hometeamOrgName,raw.homeTeamName,raw.HomeTeamName,nestedTeamName(raw.homeTeam),nestedTeamName(raw.HomeTeam),nestedTeamName(raw.home),raw.teamNameHome)}
function rowAway(raw:Row){return first(raw.awayteamOverriddenName,raw.awayteam,raw.awayteamOrgName,raw.awayTeamName,raw.AwayTeamName,nestedTeamName(raw.awayTeam),nestedTeamName(raw.AwayTeam),nestedTeamName(raw.away),raw.teamNameAway)}
function hasValidMatchId(value:unknown){const id=Number(value);return Number.isInteger(id)&&id>0}
function hockeyLiveMatchUrl(matchId:number,tournamentId:number,gameDate:string){return `https://live.hockey.no/match?seasonId=${SEASON_ID}&tournamentId=${tournamentId}&matchId=${matchId}&matchDate=${gameDate}T00:00:00`}
function knownMatch(game:DbGame){
 const home=teamKey(game.home_team),away=teamKey(game.away_team);
 return KNOWN_PRESEASON_MATCHES.find(x=>x.gameDate===game.game_date&&x.home===home&&x.away===away)||null;
}

async function loadTournamentMatches(tournamentId=PRIMARY_PRESEASON_TOURNAMENT_ID){
 const endpoint=`${TOURNAMENT_API_BASE}ta/TournamentMatches/?tournamentId=${encodeURIComponent(tournamentId)}`;
 const response=await fetch(endpoint,{headers:{Accept:"application/json","User-Agent":"StangInn/1.0 fantasy-preseason-discovery"},cache:"no-store"});
 if(!response.ok){const body=await response.text();throw new Error(`TournamentMatches svarte ${response.status}: ${body.slice(0,180)}`)}
 const payload=await response.json();
 const rows:Row[]=Array.isArray(payload)?payload:payload?.matches??payload?.data?.matches??payload?.data??[];
 const candidates:TournamentCandidate[]=[];
 for(const raw of rows){
  const matchId=Number(first(raw.matchId,raw.MatchId,raw.matchID,raw.id,raw.Id));
  const gameDate=rowDate(raw),home=rowHome(raw),away=rowAway(raw);
  if(!Number.isInteger(matchId)||matchId<=0||!gameDate||!home||!away)continue;
  candidates.push({matchId,gameDate,homeTeam:String(home),awayTeam:String(away),tournamentId});
 }
 const unique=new Map(candidates.map(c=>[c.matchId,c]));
 return{endpoint,rawRows:rows.length,candidates:[...unique.values()]};
}

function tournamentMatchesForGame(game:DbGame,candidates:TournamentCandidate[]){
 const home=teamKey(game.home_team),away=teamKey(game.away_team);
 return candidates.filter(c=>c.gameDate===game.game_date&&teamKey(c.homeTeam)===home&&teamKey(c.awayTeam)===away);
}

export async function discoverMissingPreseasonHockeyLiveIds(){
 const sb=serverClient();
 const{data,error}=await sb.from("fantasy_preseason_games").select("id,game_date,starts_at,home_team,away_team,hockeylive_match_id,source_type,notes").eq("season","2026/27").order("game_date");
 if(error)throw error;
 const allRows=(data||[]) as DbGame[];
 const rows=allRows.filter(game=>!hasValidMatchId(game.hockeylive_match_id));

 let tournament:{endpoint:string;rawRows:number;candidates:TournamentCandidate[]};
 try{tournament=await loadTournamentMatches()}
 catch(error:any){
  return{checked:rows.length,alreadyLinked:allRows.length-rows.length,primaryTournamentId:PRIMARY_PRESEASON_TOURNAMENT_ID,tournamentApiRows:0,tournamentCandidates:0,tournamentApiError:error?.message||String(error),discovered:0,ambiguous:0,notFound:rows.length,results:rows.map(game=>({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:"not_found",error:"TournamentMatches kunne ikke hentes"}))};
 }

 const results:any[]=[];
 for(const game of rows){
  const known=knownMatch(game);
  const matches=tournamentMatchesForGame(game,tournament.candidates);
  let hit:TournamentCandidate|null=null,matchMethod="tournament-matches-api";

  if(matches.length===1)hit=matches[0];
  else if(matches.length===0&&known){hit={matchId:known.matchId,gameDate:known.gameDate,homeTeam:game.home_team,awayTeam:game.away_team,tournamentId:known.tournamentId};matchMethod="known-date-team"}
  else if(matches.length>1){results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:"ambiguous",candidates:matches.map(x=>({matchId:x.matchId,homeTeam:x.homeTeam,awayTeam:x.awayTeam}))});continue}
  else{results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:"not_found"});continue}

  const note=`HOCKEYLIVE_AUTO_DISCOVERY matchId=${hit.matchId} tournamentId=${hit.tournamentId} method=${matchMethod} at=${new Date().toISOString()}`;
  const{error:updateError}=await sb.from("fantasy_preseason_games").update({hockeylive_match_id:hit.matchId,source_type:"hockeylive",source_quality:0.95,source_url:hockeyLiveMatchUrl(hit.matchId,hit.tournamentId,game.game_date),notes:[game.notes,note].filter(Boolean).join("\n"),updated_at:new Date().toISOString()}).eq("id",game.id);
  if(updateError){results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:"error",error:updateError.message});continue}
  results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:"matched",matchId:hit.matchId,tournamentId:hit.tournamentId,matchMethod});
 }

 return{checked:rows.length,alreadyLinked:allRows.length-rows.length,primaryTournamentId:PRIMARY_PRESEASON_TOURNAMENT_ID,tournamentApiRows:tournament.rawRows,tournamentCandidates:tournament.candidates.length,tournamentApiError:null,discovered:results.filter(r=>r.status==="matched").length,ambiguous:results.filter(r=>r.status==="ambiguous").length,notFound:results.filter(r=>r.status==="not_found").length,results};
}
