import {createClient} from "@supabase/supabase-js";

type Game={id:number;home_team:string;away_team:string;home_score:number|null;away_score:number|null};
type Stat={preseason_game_id:number;team:string;goals:number|null;source_type:string|null};

function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function ascii(v:unknown){return String(v||"").trim().toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function teamKey(v:unknown){const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga")||s.includes("vaalerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";if(s.includes("gjovik"))return"gjovik";if(s.includes("comet"))return"comet";if(s.includes("manglerud"))return"manglerud";return s.replace(/[^a-z0-9]+/g,"")}

export async function reconcileHockeyLivePreseasonScores(){
 const sb=serverClient();
 const{data:games,error:gErr}=await sb.from("fantasy_preseason_games").select("id,home_team,away_team,home_score,away_score").eq("season","2026/27").not("hockeylive_match_id","is",null);if(gErr)throw gErr;
 const ids=((games||[]) as Game[]).filter(g=>g.home_score==null||g.away_score==null).map(g=>g.id);if(!ids.length)return{checked:0,updated:0,results:[]};
 const{data:stats,error:sErr}=await sb.from("fantasy_preseason_player_stats").select("preseason_game_id,team,goals,source_type").in("preseason_game_id",ids).eq("source_type","hockeylive");if(sErr)throw sErr;
 const byGame=new Map<number,Stat[]>();for(const row of (stats||[]) as Stat[]){const list=byGame.get(row.preseason_game_id)||[];list.push(row);byGame.set(row.preseason_game_id,list)}
 const results:any[]=[];let updated=0;
 for(const game of (games||[]) as Game[]){if(!ids.includes(game.id))continue;const rows=byGame.get(game.id)||[];const hk=teamKey(game.home_team),ak=teamKey(game.away_team);let home=0,away=0,recognized=0;for(const row of rows){const k=teamKey(row.team),goals=Number(row.goals||0);if(k===hk){home+=goals;recognized++}else if(k===ak){away+=goals;recognized++}}
  if(recognized>0&&home+away>0){const{error}=await sb.from("fantasy_preseason_games").update({home_score:home,away_score:away,status:"finished",source_type:"hockeylive",source_quality:0.95,updated_at:new Date().toISOString()}).eq("id",game.id);if(error)throw error;updated++;results.push({gameId:game.id,home,away,method:"player-goal-sum"})}
 }
 return{checked:ids.length,updated,results};
}
