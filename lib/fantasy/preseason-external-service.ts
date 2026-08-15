import {createClient} from "@supabase/supabase-js";
import registry from "../../data/fantasy-preseason-external-2026.json";

type RegistryStat={
  playerName:string;
  team:string;
  position?:string|null;
  didPlay?:boolean|null;
  goals?:number;
  assists?:number;
  shots?:number;
  plusMinus?:number;
  pim?:number;
  saves?:number;
  goalsAgainst?:number;
  minutesPlayed?:number;
  win?:boolean|null;
  shutout?:boolean|null;
  powerplayGoals?:number;
  powerplayAssists?:number;
  shorthandedGoals?:number;
  shorthandedAssists?:number;
  knownFields:string[];
  sourceQuality:number;
};

type RegistryGame={
  gameDate:string;
  homeTeam:string;
  awayTeam:string;
  homeScore?:number|null;
  awayScore?:number|null;
  status:"scheduled"|"finished"|"cancelled";
  sourceType:"official"|"web"|"manual";
  sourceQuality:number;
  sources:{url:string;label:string;role:string}[];
  stats:RegistryStat[];
  notes?:string|null;
};

type FantasyPlayer={id:string;name:string;team:string;position:string|null;on_current_roster:boolean|null};
type MatchResult={player:FantasyPlayer|null;confidence:"exact"|"strong"|"none";reason:string;candidates:FantasyPlayer[]};

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function text(v:unknown){return v==null?"":String(v).trim()}
function ascii(v:unknown){return text(v).toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function norm(v:unknown){return ascii(v).replace(/[^a-z0-9]+/g,"")}
function nameTokens(v:unknown){return ascii(v).replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean)}
function canonicalTeam(v:unknown){const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return norm(v)}

async function loadFantasyPlayers(sb:any){
  const rows:FantasyPlayer[]=[];
  for(let from=0;;from+=1000){
    const{data,error}=await sb.from("fantasy_players").select("id,name,team,position,on_current_roster").range(from,from+999);
    if(error)throw error;
    rows.push(...((data||[]) as FantasyPlayer[]));
    if((data||[]).length<1000)break;
  }
  return rows;
}

function matchPlayer(stat:RegistryStat,players:FantasyPlayer[]):MatchResult{
  const teamKey=canonicalTeam(stat.team);
  const teamPlayers=players.filter(p=>canonicalTeam(p.team)===teamKey);
  if(!teamPlayers.length)return{player:null,confidence:"none",reason:"Ingen Fantasy-spillere på samme lag",candidates:[]};

  const exact=teamPlayers.filter(p=>norm(p.name)===norm(stat.playerName));
  if(exact.length===1)return{player:exact[0],confidence:"exact",reason:"Eksakt normalisert navn + samme lag",candidates:exact};
  if(exact.length>1)return{player:null,confidence:"none",reason:"Flere eksakte kandidater",candidates:exact};

  const sourceTokens=nameTokens(stat.playerName);
  const first=sourceTokens[0]||"";
  const last=sourceTokens[sourceTokens.length-1]||"";
  const firstLast=teamPlayers.filter(p=>{
    const t=nameTokens(p.name);
    return t.length>=2&&t[0]===first&&t[t.length-1]===last;
  });
  if(firstLast.length===1)return{player:firstLast[0],confidence:"strong",reason:"Entydig fornavn + etternavn + samme lag",candidates:firstLast};
  if(firstLast.length>1)return{player:null,confidence:"none",reason:"Flere kandidater med samme fornavn/etternavn",candidates:firstLast};

  const sourceSet=new Set(sourceTokens);
  const subset=teamPlayers.filter(p=>{
    const candidateTokens=nameTokens(p.name);
    const candidateSet=new Set(candidateTokens);
    const sourceInside=[...sourceSet].every(t=>candidateSet.has(t));
    const candidateInside=candidateTokens.every(t=>sourceSet.has(t));
    return sourceInside||candidateInside;
  });
  if(subset.length===1)return{player:subset[0],confidence:"strong",reason:"Entydig navnetoken-match + samme lag",candidates:subset};

  const lastName=teamPlayers.filter(p=>{const t=nameTokens(p.name);return t[t.length-1]===last});
  return{player:null,confidence:"none",reason:"Ingen sikker auto-match",candidates:lastName.slice(0,5)};
}

function rawKnown(stat:RegistryStat,game:RegistryGame,match:MatchResult){
  return {
    source:"external-preseason-registry",
    knownFields:stat.knownFields,
    sources:game.sources,
    match:{confidence:match.confidence,reason:match.reason},
    game:{gameDate:game.gameDate,homeTeam:game.homeTeam,awayTeam:game.awayTeam},
  };
}

export async function importExternalPreseasonRegistry(){
  const sb=serverClient();
  const players=await loadFantasyPlayers(sb);
  const results:any[]=[];

  for(const game of (registry.games as RegistryGame[])){
    const{data:dbGame,error:gameError}=await sb.from("fantasy_preseason_games").select("*").eq("season",registry.season).eq("game_date",game.gameDate).eq("home_team",game.homeTeam).eq("away_team",game.awayTeam).maybeSingle();
    if(gameError)throw gameError;
    if(!dbGame){results.push({ok:false,game:`${game.homeTeam} - ${game.awayTeam}`,error:"Kampen finnes ikke i fantasy_preseason_games"});continue;}

    const primarySource=game.sources.find(s=>s.role==="official_report")||game.sources.find(s=>s.role==="official_events")||game.sources.find(s=>s.role==="official_schedule")||game.sources[0]||null;
    const patch:any={home_score:game.homeScore??dbGame.home_score,away_score:game.awayScore??dbGame.away_score,status:game.status,source_type:game.sourceType,source_quality:Math.max(Number(dbGame.source_quality||0),Number(game.sourceQuality||0)),source_url:primarySource?.url||dbGame.source_url,notes:[dbGame.notes,game.notes,`External sources: ${game.sources.map(s=>`${s.label} (${s.role})`).join(" | ")}`].filter(Boolean).join("\n"),updated_at:new Date().toISOString()};
    const{error:patchError}=await sb.from("fantasy_preseason_games").update(patch).eq("id",dbGame.id);if(patchError)throw patchError;

    let matched=0,unmatched=0,rows=0,strong=0;
    for(const stat of game.stats||[]){
      const match=matchPlayer(stat,players),player=match.player;
      const row={preseason_game_id:dbGame.id,player_id:player?.id||null,raw_player_name:stat.playerName,team:stat.team,position:player?.position||stat.position||null,did_play:stat.didPlay??null,goals:Number(stat.goals||0),assists:Number(stat.assists||0),shots:Number(stat.shots||0),plus_minus:Number(stat.plusMinus||0),pim:Number(stat.pim||0),saves:Number(stat.saves||0),goals_against:Number(stat.goalsAgainst||0),minutes_played:Number(stat.minutesPlayed||0),win:stat.win??null,shutout:stat.shutout??null,powerplay_goals:Number(stat.powerplayGoals||0),powerplay_assists:Number(stat.powerplayAssists||0),shorthanded_goals:Number(stat.shorthandedGoals||0),shorthanded_assists:Number(stat.shorthandedAssists||0),source_type:game.sourceType,source_quality:Number(stat.sourceQuality||game.sourceQuality||0.5),raw:rawKnown(stat,game,match),updated_at:new Date().toISOString()};
      const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});if(error)throw error;
      rows++;if(player){matched++;if(match.confidence==="strong")strong++;}else unmatched++;
    }
    results.push({ok:true,preseasonGameId:dbGame.id,game:`${game.homeTeam} - ${game.awayTeam}`,rows,matched,strong,unmatched,sourceUrl:primarySource?.url||null});
  }

  return{registryGames:(registry.games||[]).length,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
}

export async function diagnoseExternalPreseasonMatches(){
  const sb=serverClient();
  const players=await loadFantasyPlayers(sb);
  const rows:any[]=[];
  for(const game of (registry.games as RegistryGame[])){
    for(const stat of game.stats||[]){
      const match=matchPlayer(stat,players);
      rows.push({gameDate:game.gameDate,game:`${game.homeTeam} - ${game.awayTeam}`,rawPlayerName:stat.playerName,rawTeam:stat.team,matched:!!match.player,confidence:match.confidence,reason:match.reason,matchedPlayer:match.player?{id:match.player.id,name:match.player.name,team:match.player.team,position:match.player.position}:null,candidates:match.candidates.map(p=>({id:p.id,name:p.name,team:p.team,position:p.position}))});
    }
  }
  return{total:rows.length,matched:rows.filter(r=>r.matched).length,unmatched:rows.filter(r=>!r.matched).length,strong:rows.filter(r=>r.confidence==="strong").length,rows};
}

export function getExternalPreseasonRegistrySummary(){return{season:registry.season,scheduleReference:registry.scheduleReference,games:(registry.games||[]).map((g:any)=>({gameDate:g.gameDate,homeTeam:g.homeTeam,awayTeam:g.awayTeam,sourceQuality:g.sourceQuality,statRows:(g.stats||[]).length,sources:g.sources||[]}))};}
