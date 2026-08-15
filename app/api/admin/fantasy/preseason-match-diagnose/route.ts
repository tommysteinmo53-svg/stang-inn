import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {diagnoseExternalPreseasonMatches} from "../../../../../lib/fantasy/preseason-external-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function text(v:unknown){return v==null?"":String(v).trim()}
function ascii(v:unknown){return text(v).toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function teamKey(v:unknown){const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return s.replace(/[^a-z0-9]+/g,"")}

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  try{
    const external=await diagnoseExternalPreseasonMatches();
    const sb=serverClient();
    const{data,error}=await sb
      .from("fantasy_preseason_player_stats")
      .select("raw_player_name,team,source_type,preseason_game_id,fantasy_preseason_games!inner(id,home_team,away_team,home_league_code,away_league_code,game_date)")
      .is("player_id",null)
      .eq("source_type","hockeylive");
    if(error)throw error;

    const hockeyliveRows=(data||[]).map((r:any)=>{
      const g=Array.isArray(r.fantasy_preseason_games)?r.fantasy_preseason_games[0]:r.fantasy_preseason_games;
      const key=teamKey(r.team),home=teamKey(g?.home_team),away=teamKey(g?.away_team);
      const ehlSide=(key===home&&g?.home_league_code==="EHL")||(key===away&&g?.away_league_code==="EHL");
      return{gameDate:g?.game_date||null,game:`${g?.home_team||"?"} - ${g?.away_team||"?"}`,rawPlayerName:r.raw_player_name,rawTeam:r.team,ehlSide,reason:ehlSide?"HockeyLive-spiller på EHL-lag mangler Fantasy-match":"Spiller tilhører ikke EHL-siden i kampen"};
    });
    const ehlUnmatched=hockeyliveRows.filter(r=>r.ehlSide);
    const nonEhlUnmatched=hockeyliveRows.filter(r=>!r.ehlSide);

    return NextResponse.json({ok:true,...external,hockeylive:{totalUnmatched:hockeyliveRows.length,ehlUnmatched:ehlUnmatched.length,nonEhlUnmatched:nonEhlUnmatched.length,rows:hockeyliveRows,ehlRows:ehlUnmatched}});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Kunne ikke kjøre preseason match-diagnose"},{status:500});
  }
}
