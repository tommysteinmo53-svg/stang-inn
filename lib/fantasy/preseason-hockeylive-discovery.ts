import {createClient} from "@supabase/supabase-js";

const SEASON_ID=201071;
const PRIMARY_PRESEASON_TOURNAMENT_ID=448939;
const PRESEASON_TOURNAMENT_IDS=[PRIMARY_PRESEASON_TOURNAMENT_ID,448981,448684];
const KNOWN_PRESEASON_MATCHES=[
 {gameDate:"2026-08-15",home:"nidaros",away:"ringerike",matchId:8450777,tournamentId:448939},
 {gameDate:"2026-08-16",home:"nidaros",away:"ringerike",matchId:8450778,tournamentId:448939},
] as const;

type DbGame={id:number;game_date:string;starts_at:string|null;home_team:string;away_team:string;hockeylive_match_id:number|null;source_type:string|null;notes:string|null};
type Candidate={matchId:number;text:string;url:string;tournamentId:number|null};

function serverClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error("Supabase server-variabler mangler");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function ascii(v:unknown){return String(v??"").trim().toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function norm(v:unknown){return ascii(v).replace(/[^a-z0-9]+/g,"")}
function teamKey(v:unknown){const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga")||s.includes("vaalerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";if(s.includes("comet"))return"comet";if(s.includes("gjovik"))return"gjovik";if(s.includes("manglerud"))return"manglerud";if(s.includes("gruner"))return"gruner";if(s.includes("ski"))return"ski";if(s.includes("kongsvinger"))return"kongsvinger";return norm(v)}
function decodeHtml(s:string){return s.replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#x2F;/g,"/").replace(/&#47;/g,"/").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function tournamentIdFromText(s:string){const m=s.match(/tournamentId(?:=|%3D)(\d+)/i);return m?Number(m[1]):null}

async function fetchHtml(url:string){
 const res=await fetch(url,{headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"StangInn/1.0 fantasy-preseason-discovery"},cache:"no-store"});
 if(!res.ok)throw new Error(`HockeyLive discovery svarte ${res.status}`);
 return await res.text();
}

function candidatesFromHtml(html:string,sourceUrl:string):Candidate[]{
 const out=new Map<number,Candidate>();
 const rx=/matchId(?:=|%3D)(\d{6,9})/gi;let m:RegExpExecArray|null;
 while((m=rx.exec(html))){
  const id=Number(m[1]);if(!Number.isInteger(id)||id<=0)continue;
  const from=Math.max(0,m.index-2600),to=Math.min(html.length,m.index+2600);
  const raw=html.slice(from,to),snippet=decodeHtml(raw);
  const tournamentId=tournamentIdFromText(raw)||tournamentIdFromText(sourceUrl);
  const current=out.get(id);if(!current||snippet.length>current.text.length)out.set(id,{matchId:id,text:snippet,url:sourceUrl,tournamentId});
 }
 return [...out.values()];
}

function dateTokens(date:string){
 const [y,m,d]=date.split("-");if(!y||!m||!d)return[];
 const dd=String(Number(d)),mm=String(Number(m));
 return [date,`${d}.${m}.${y}`,`${dd}.${mm}.${y}`,`${d}/${m}/${y}`,`${dd}/${mm}/${y}`,`${d}.${m}.`,`${dd}.${mm}.`].map(ascii);
}
function sourceIsDateScoped(game:DbGame,url:string){
 try{
  const decoded=decodeURIComponent(url);
  return decoded.includes(`matchDate=${game.game_date}`)||decoded.includes(game.game_date+"T00:00:00");
 }catch{return url.includes(game.game_date)}
}
function candidateMatches(game:DbGame,c:Candidate){
 const t=ascii(c.text),compact=norm(c.text),home=teamKey(game.home_team),away=teamKey(game.away_team);
 if(!home||!away)return false;
 const hasHome=t.includes(home)||compact.includes(home);
 const hasAway=t.includes(away)||compact.includes(away);
 if(!hasHome||!hasAway)return false;
 if(sourceIsDateScoped(game,c.url))return true;
 const dates=dateTokens(game.game_date);
 return dates.length===0||dates.some(x=>t.includes(x));
}
function knownMatch(game:DbGame){
 const home=teamKey(game.home_team),away=teamKey(game.away_team);
 return KNOWN_PRESEASON_MATCHES.find(x=>x.gameDate===game.game_date&&x.home===home&&x.away===away)||null;
}
function hasValidMatchId(value:unknown){const id=Number(value);return Number.isInteger(id)&&id>0}
function scheduleUrl(tournamentId=PRIMARY_PRESEASON_TOURNAMENT_ID){return `https://live.hockey.no/schedule?seasonId=${SEASON_ID}&tournamentId=${tournamentId}`}

async function loadPrimaryTournamentSchedule(){
 const url=scheduleUrl();
 try{return{url,candidates:candidatesFromHtml(await fetchHtml(url),url),error:null as string|null}}
 catch(error:any){return{url,candidates:[] as Candidate[],error:error?.message||String(error)}}
}

async function discoverOne(game:DbGame,primarySchedule:Candidate[]){
 const known=knownMatch(game);
 if(known)return{status:"matched" as const,matchId:known.matchId,tournamentId:known.tournamentId,sourceUrl:`https://live.hockey.no/match?seasonId=${SEASON_ID}&tournamentId=${known.tournamentId}&matchId=${known.matchId}&matchDate=${game.game_date}T00:00:00`,matches:[{matchId:known.matchId,tournamentId:known.tournamentId}],candidateCount:1,fetchErrors:[],matchMethod:"known-date-team"};

 const scheduleMatches=primarySchedule.filter(c=>candidateMatches(game,c));
 if(scheduleMatches.length===1){const hit=scheduleMatches[0];return{status:"matched" as const,matchId:hit.matchId,tournamentId:PRIMARY_PRESEASON_TOURNAMENT_ID,sourceUrl:hit.url,matches:[{matchId:hit.matchId,tournamentId:PRIMARY_PRESEASON_TOURNAMENT_ID}],candidateCount:primarySchedule.length,fetchErrors:[],matchMethod:"primary-tournament-schedule"}}

 const dateParam=encodeURIComponent(game.game_date+"T00:00:00");
 const pages:string[]=[`https://live.hockey.no/?seasonId=${SEASON_ID}&matchDate=${dateParam}`];
 for(const tournamentId of PRESEASON_TOURNAMENT_IDS){
  pages.push(`https://live.hockey.no/?seasonId=${SEASON_ID}&tournamentId=${tournamentId}&matchDate=${dateParam}`);
  if(tournamentId!==PRIMARY_PRESEASON_TOURNAMENT_ID)pages.push(scheduleUrl(tournamentId));
 }
 const all=new Map<number,Candidate>(),fetchErrors:string[]=[];
 for(const c of primarySchedule)all.set(c.matchId,c);
 for(const url of pages){
  try{for(const c of candidatesFromHtml(await fetchHtml(url),url)){const old=all.get(c.matchId);if(!old||c.text.length>old.text.length)all.set(c.matchId,c)}}
  catch(error:any){fetchErrors.push(`${url}: ${error?.message||String(error)}`)}
 }
 const matches=[...all.values()].filter(c=>candidateMatches(game,c));
 if(matches.length!==1)return{status:matches.length===0?"not_found":"ambiguous" as const,matches:matches.map(x=>({matchId:x.matchId,tournamentId:x.tournamentId})),candidateCount:all.size,fetchErrors};
 const hit=matches[0];
 return{status:"matched" as const,matchId:hit.matchId,tournamentId:hit.tournamentId,sourceUrl:hit.url,matches:[{matchId:hit.matchId,tournamentId:hit.tournamentId}],candidateCount:all.size,fetchErrors,matchMethod:"discovery"};
}

export async function discoverMissingPreseasonHockeyLiveIds(){
 const sb=serverClient();
 const{data,error}=await sb.from("fantasy_preseason_games").select("id,game_date,starts_at,home_team,away_team,hockeylive_match_id,source_type,notes").eq("season","2026/27").order("game_date");
 if(error)throw error;
 const allRows=(data||[]) as DbGame[];
 const rows=allRows.filter(game=>!hasValidMatchId(game.hockeylive_match_id));
 const primary=await loadPrimaryTournamentSchedule();
 const results:any[]=[];
 for(const game of rows){
  const found=await discoverOne(game,primary.candidates);
  if(found.status!=="matched"){
   results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:found.status,candidates:found.matches,candidateCount:found.candidateCount,fetchErrors:found.fetchErrors});
   continue;
  }
  const tournamentId=found.tournamentId||PRIMARY_PRESEASON_TOURNAMENT_ID;
  const note=`HOCKEYLIVE_AUTO_DISCOVERY matchId=${found.matchId} tournamentId=${tournamentId} method=${found.matchMethod||"discovery"} at=${new Date().toISOString()}`;
  const{error:updateError}=await sb.from("fantasy_preseason_games").update({hockeylive_match_id:found.matchId,source_type:"hockeylive",source_quality:0.95,source_url:`https://live.hockey.no/match?seasonId=${SEASON_ID}&tournamentId=${tournamentId}&matchId=${found.matchId}&matchDate=${game.game_date}T00:00:00`,notes:[game.notes,note].filter(Boolean).join("\n"),updated_at:new Date().toISOString()}).eq("id",game.id);
  if(updateError){results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:"error",error:updateError.message});continue}
  results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,gameDate:game.game_date,status:"matched",matchId:found.matchId,tournamentId,candidateCount:found.candidateCount,matchMethod:found.matchMethod||"discovery"});
 }
 return{checked:rows.length,alreadyLinked:allRows.length-rows.length,primaryTournamentId:PRIMARY_PRESEASON_TOURNAMENT_ID,primaryScheduleCandidates:primary.candidates.length,primaryScheduleError:primary.error,discovered:results.filter(r=>r.status==="matched").length,ambiguous:results.filter(r=>r.status==="ambiguous").length,notFound:results.filter(r=>r.status==="not_found").length,results};
}
