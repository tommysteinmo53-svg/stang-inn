import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function norm(v:any){return String(v??"").trim().toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"")}
function teamKey(v:any){const s=norm(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return s}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;

  try{
    const sb=serverClient();
    const[{data:stats,error:se},{data:games,error:ge},{data:players,error:pe}]=await Promise.all([
      sb.from("fantasy_preseason_player_stats").select("id,preseason_game_id,player_id,raw_player_name,team,position,source_type").not("player_id","is",null),
      sb.from("fantasy_preseason_games").select("id,game_date,home_team,away_team,home_league_code,away_league_code").eq("season","2026/27"),
      sb.from("fantasy_players").select("id,name,team,position,on_current_roster,active")
    ]);
    if(se)throw se;if(ge)throw ge;if(pe)throw pe;

    const gameMap=new Map((games||[]).map((g:any)=>[String(g.id),g]));
    const playerMap=new Map((players||[]).map((p:any)=>[String(p.id),p]));

    const rows=(stats||[]).map((s:any)=>{
      const g:any=gameMap.get(String(s.preseason_game_id));
      const p:any=playerMap.get(String(s.player_id));
      const sameTeam=!!p&&teamKey(s.team)===teamKey(p.team);
      const sideLeague=g?(teamKey(s.team)===teamKey(g.home_team)?g.home_league_code:teamKey(s.team)===teamKey(g.away_team)?g.away_league_code:null):null;
      const ehlSide=sideLeague==="EHL";
      const xfpEligible=!!p&&sameTeam&&ehlSide&&!!p.on_current_roster;
      const category=xfpEligible?"XFP_ELIGIBLE":sameTeam&&!ehlSide?"SAME_TEAM_NON_EHL":!sameTeam?"CROSS_TEAM_IDENTITY":"OTHER";
      return {
        category,
        xfpEligible,
        gameDate:g?.game_date||null,
        game:g?`${g.home_team} - ${g.away_team}`:null,
        preseasonName:s.raw_player_name,
        preseasonTeam:s.team,
        sourceType:s.source_type,
        playerId:s.player_id,
        fantasyName:p?.name||null,
        fantasyTeam:p?.team||null,
        fantasyPosition:p?.position||null,
        onCurrentRoster:p?.on_current_roster??null,
        active:p?.active??null,
        sideLeague
      };
    });

    return NextResponse.json({
      ok:true,
      total:rows.length,
      xfpEligible:rows.filter(r=>r.category==="XFP_ELIGIBLE").length,
      crossTeam:rows.filter(r=>r.category==="CROSS_TEAM_IDENTITY").length,
      sameTeamNonEhl:rows.filter(r=>r.category==="SAME_TEAM_NON_EHL").length,
      rows
    });
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Kunne ikke kjøre preseason roster-audit"},{status:500});
  }
}
