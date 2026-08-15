import {createClient} from "@supabase/supabase-js";

const SEASON_ID=201071;
// Known 2026/27 HockeyLive tournaments that have contained preseason/EHL-related games.
// Discovery also checks the global date scoreboard, so a game may be found even when
// HockeyLive places it in another tournament.
const PRESEASON_TOURNAMENT_IDS=[448939,448981,448684];

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
  const from=Math.max(0,m.index-1800),to=Math.min(html.length,m.index+1800);
  const raw=html.slice(from,to),snippet=decodeHtml(raw);
  const tournamentId=tournamentIdFromText(raw)||tournamentIdFromText(sourceUrl);
  const current=out.get(id);if(!current||snippet.length>current.text.length)out.set(id,{matchId:id,text:snippet,url:sourceUrl,tournamentId});
 }
 return [...out.values()];
}

function dateTokens(date:string){
 const [y,m,d]=date.split("-");
 if(!y||!m||!d)return[];
 const dd=String(Number(d)),mm=String(Number(m));
 return [date,`${d}.${m}.${y}`,`${dd}.${mm}.${y}`,`${d}/${m}/${y}`,`${dd}/${mm}/${y}`,`${d}.${m}.`,`${dd}.${mm}.`].map(ascii);
}
function candidateMatches(game:DbGame,c:Candidate){
 const t=ascii(c.text),compact=norm(c.text),home=teamKey(game.home_team),away=teamKey(game.away_team);
 if(!home||!away)return false;
 const hasHome=t.includes(home)||compact.includes(home);
 const hasAway=t.includes(away)||compact.includes(away);
 if(!hasHome||!hasAway)return false;
 const dates=dateTokens(game.game_date);
 return dates.length===0||dates.some(x=>t.includes(x));
}

async function discoverOne(game:DbGame){
 const dateParam=encodeURIComponent(game.game_date+"T00:00:00");
 const pages:string[]=[
  // Most important fallback: HockeyLive's global scoreboard for the date also exposes
  // matches from tournaments other than the selected one.
  `https://live.hockey.no/?seasonId=${SEASON_ID}&matchDate=${dateParam}`,
 ];
 for(const tournamentId of PRESEASON_TOURNAMENT_IDS){
  pages.push(`https://live.hockey.no/?seasonId=${SEASON_ID}&tournamentId=${tournamentId}&matchDate=${dateParam}`);
  pages.push(`https://live.hockey.no/schedule?seasonId=${SEASON_ID}&tournamentId=${tournamentId}`);
 }
 const all=new Map<number,Candidate>();
 for(const url of pages){
  try{for(const c of candidatesFromHtml(await fetchHtml(url),url)){const old=all.get(c.matchId);if(!old||c.text.length>old.text.length)all.set(c.matchId,c)}}catch{/* discovery must never block normal import */}
 }
 const matches=[...all.values()].filter(c=>candidateMatches(game,c));
 if(matches.length!==1)return{status:matches.length===0?"not_found":"ambiguous" as const,matches:matches.map(x=>({matchId:x.matchId,tournamentId:x.tournamentId}))};
 const hit=matches[0];
 return{status:"matched" as const,matchId:hit.matchId,tournamentId:hit.tournamentId,sourceUrl:hit.url,matches:[{matchId:hit.matchId,tournamentId:hit.tournamentId}]};
}

export async function discoverMissingPreseasonHockeyLiveIds(){
 const sb=serverClient();
 const{data,error}=await sb.from("fantasy_preseason_games").select("id,game_date,starts_at,home_team,away_team,hockeylive_match_id,source_type,notes").eq("season","2026/27").is("hockeylive_match_id",null).order("game_date");
 if(error)throw error;
 const rows=(data||[]) as DbGame[],results:any[]=[];
 for(const game of rows){
  const found=await discoverOne(game);
  if(found.status!=="matched"){
   results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,status:found.status,candidates:found.matches});
   continue;
  }
  const tournamentId=found.tournamentId||PRESEASON_TOURNAMENT_IDS[0];
  const note=`HOCKEYLIVE_AUTO_DISCOVERY matchId=${found.matchId} tournamentId=${tournamentId} at=${new Date().toISOString()}`;
  const{error:updateError}=await sb.from("fantasy_preseason_games").update({hockeylive_match_id:found.matchId,source_type:"hockeylive",source_quality:0.95,source_url:`https://live.hockey.no/match?seasonId=${SEASON_ID}&tournamentId=${tournamentId}&matchId=${found.matchId}&matchDate=${game.game_date}T00:00:00`,notes:[game.notes,note].filter(Boolean).join("\n"),updated_at:new Date().toISOString()}).eq("id",game.id);
  if(updateError){results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,status:"error",error:updateError.message});continue}
  results.push({gameId:game.id,game:`${game.home_team} – ${game.away_team}`,status:"matched",matchId:found.matchId,tournamentId});
 }
 return{checked:rows.length,discovered:results.filter(r=>r.status==="matched").length,ambiguous:results.filter(r=>r.status==="ambiguous").length,notFound:results.filter(r=>r.status==="not_found").length,results};
}
