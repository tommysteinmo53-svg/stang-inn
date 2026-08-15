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

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function text(v:unknown){return v==null?"":String(v).trim()}
function norm(v:unknown){return text(v).toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"")}
function canonicalTeam(v:unknown){const s=text(v).toLocaleLowerCase("nb-NO");if(s.includes("nidaros"))return"nidaros";if(s.includes("lørenskog")||s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("vålerenga")||s.includes("valerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return norm(v)}

async function loadFantasyPlayers(sb:any){
  const rows:any[]=[];
  for(let from=0;;from+=1000){
    const{data,error}=await sb.from("fantasy_players").select("id,name,team,position,on_current_roster").range(from,from+999);
    if(error)throw error;
    rows.push(...(data||[]));
    if((data||[]).length<1000)break;
  }
  return rows;
}

function findPlayer(stat:RegistryStat,players:any[]){
  const nameKey=norm(stat.playerName),teamKey=canonicalTeam(stat.team);
  const sameName=players.filter(p=>norm(p.name)===nameKey);
  if(sameName.length===1)return sameName[0];
  return sameName.find(p=>canonicalTeam(p.team)===teamKey)||null;
}

function rawKnown(stat:RegistryStat,game:RegistryGame){
  return {
    source:"external-preseason-registry",
    knownFields:stat.knownFields,
    sources:game.sources,
    game:{gameDate:game.gameDate,homeTeam:game.homeTeam,awayTeam:game.awayTeam},
  };
}

export async function importExternalPreseasonRegistry(){
  const sb=serverClient();
  const players=await loadFantasyPlayers(sb);
  const results:any[]=[];

  for(const game of (registry.games as RegistryGame[])){
    const{data:dbGame,error:gameError}=await sb
      .from("fantasy_preseason_games")
      .select("*")
      .eq("season",registry.season)
      .eq("game_date",game.gameDate)
      .eq("home_team",game.homeTeam)
      .eq("away_team",game.awayTeam)
      .maybeSingle();
    if(gameError)throw gameError;
    if(!dbGame){
      results.push({ok:false,game:`${game.homeTeam} - ${game.awayTeam}`,error:"Kampen finnes ikke i fantasy_preseason_games"});
      continue;
    }

    const primarySource=game.sources.find(s=>s.role==="official_report")||game.sources.find(s=>s.role==="official_events")||game.sources.find(s=>s.role==="official_schedule")||game.sources[0]||null;
    const patch:any={
      home_score:game.homeScore??dbGame.home_score,
      away_score:game.awayScore??dbGame.away_score,
      status:game.status,
      source_type:game.sourceType,
      source_quality:Math.max(Number(dbGame.source_quality||0),Number(game.sourceQuality||0)),
      source_url:primarySource?.url||dbGame.source_url,
      notes:[dbGame.notes,game.notes,`External sources: ${game.sources.map(s=>`${s.label} (${s.role})`).join(" | ")}`].filter(Boolean).join("\n"),
      updated_at:new Date().toISOString(),
    };
    const{error:patchError}=await sb.from("fantasy_preseason_games").update(patch).eq("id",dbGame.id);
    if(patchError)throw patchError;

    let matched=0,unmatched=0,rows=0;
    for(const stat of game.stats||[]){
      const player=findPlayer(stat,players);
      const row={
        preseason_game_id:dbGame.id,
        player_id:player?.id||null,
        raw_player_name:stat.playerName,
        team:stat.team,
        position:player?.position||stat.position||null,
        did_play:stat.didPlay??null,
        goals:Number(stat.goals||0),
        assists:Number(stat.assists||0),
        shots:Number(stat.shots||0),
        plus_minus:Number(stat.plusMinus||0),
        pim:Number(stat.pim||0),
        saves:Number(stat.saves||0),
        goals_against:Number(stat.goalsAgainst||0),
        minutes_played:Number(stat.minutesPlayed||0),
        win:stat.win??null,
        shutout:stat.shutout??null,
        powerplay_goals:Number(stat.powerplayGoals||0),
        powerplay_assists:Number(stat.powerplayAssists||0),
        shorthanded_goals:Number(stat.shorthandedGoals||0),
        shorthanded_assists:Number(stat.shorthandedAssists||0),
        source_type:game.sourceType,
        source_quality:Number(stat.sourceQuality||game.sourceQuality||0.5),
        raw:rawKnown(stat,game),
        updated_at:new Date().toISOString(),
      };
      const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});
      if(error)throw error;
      rows++;
      if(player)matched++;else unmatched++;
    }
    results.push({ok:true,preseasonGameId:dbGame.id,game:`${game.homeTeam} - ${game.awayTeam}`,rows,matched,unmatched,sourceUrl:primarySource?.url||null});
  }

  return {
    registryGames:(registry.games||[]).length,
    succeeded:results.filter(r=>r.ok).length,
    failed:results.filter(r=>!r.ok).length,
    results,
  };
}

export function getExternalPreseasonRegistrySummary(){
  return {
    season:registry.season,
    scheduleReference:registry.scheduleReference,
    games:(registry.games||[]).map((g:any)=>({
      gameDate:g.gameDate,
      homeTeam:g.homeTeam,
      awayTeam:g.awayTeam,
      sourceQuality:g.sourceQuality,
      statRows:(g.stats||[]).length,
      sources:g.sources||[],
    })),
  };
}
