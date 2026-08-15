import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const SEASON="2026/27";
const HISTORICAL_SEASON="2025/26";

function userClient(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}
function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function ascii(v:unknown){return String(v??"").trim().toLowerCase().replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function teamKey(v:unknown){const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"stavanger";if(s.includes("valerenga")||s.includes("vaalerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return s.replace(/[^a-z0-9]+/g,"")}
function preseasonOpponentFactor(team:unknown){switch(teamKey(team)){case"storhamar":return .80;case"valerenga":return .86;case"frisk":return .90;case"stavanger":return .94;case"narvik":return .99;case"sparta":return 1.04;case"stjernen":return 1.08;case"lillehammer":return 1.13;case"lorenskog":return 1.20;case"nidaros":return 1.24;case"ringerike":return 1.28;default:return 1}}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function avg(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0}
function fantasyPoints(stat:any,position:string){
  const pos=String(stat.position_snapshot||position||"W");
  const goals=Number(stat.goals||0),assists=Number(stat.assists||0),shots=Number(stat.shots||0),pm=Number(stat.plus_minus||0),pim=Number(stat.pim||0);
  if(pos==="G"){
    const active=Number(stat.minutes_played||0)>0||Number(stat.saves||0)>0||Number(stat.goals_against||0)>0;
    if(!active)return null;
    return 2+goals*15+assists*8+shots+pm-Math.min(10,Math.max(0,pim))+Number(stat.saves||0)/2-Number(stat.goals_against||0)*3+(stat.shutout?10:0)+(stat.win?5:0);
  }
  if(!stat.did_play)return null;
  return 2+goals*(pos==="D"?15:10)+assists*(pos==="D"?8:6)+shots+pm-Math.min(10,Math.max(0,pim));
}
function chunks<T>(items:T[],size=25){const out:T[][]=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
async function fetchByPlayerIds(sb:any,table:string,select:string,ids:string[]){
  const rows:any[]=[];
  for(const group of chunks(ids)){
    let from=0;
    while(true){
      const{data,error}=await sb.from(table).select(select).in("player_id",group).range(from,from+999);
      if(error)throw error;
      const batch=data||[];rows.push(...batch);
      if(batch.length<1000)break;
      from+=1000;
    }
  }
  return rows;
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const authSb=userClient(request),sb=serverClient();
  if(!authSb||!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});

  try{
    // Keep the guarded preseason signal RPC: it is small and already handles eligibility/matching rules.
    const preRes=await authSb.rpc("get_fantasy_preseason_signal_admin_v1",{p_season:SEASON});
    if(preRes.error)throw new Error(`preseason: ${preRes.error.message}`);
    const preseasonRows=(preRes.data||[]) as any[];
    if(!preseasonRows.length)return NextResponse.json({ok:true,rows:[],source:"server-baseline"});

    const playerIds=[...new Set(preseasonRows.map((r:any)=>String(r.player_id)).filter(Boolean))];

    const[{data:settings,error:settingsError},{data:prices,error:priceError},{data:histGames,error:histGamesError},{data:currentGames,error:currentGamesError}]=await Promise.all([
      sb.from("fantasy_xfp_settings").select("season_weight,form_weight,venue_weight,opponent_weight").eq("season",SEASON).maybeSingle(),
      sb.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON).in("player_id",playerIds),
      sb.from("fantasy_games").select("id,starts_at,home_team,away_team,home_score,away_score,status").eq("season",HISTORICAL_SEASON),
      sb.from("fantasy_games").select("id,starts_at,home_team,away_team,home_score,away_score,status").eq("season",SEASON),
    ]);
    if(settingsError)throw settingsError;if(priceError)throw priceError;if(histGamesError)throw histGamesError;if(currentGamesError)throw currentGamesError;

    const [historicalStats,currentPoints]=await Promise.all([
      fetchByPlayerIds(sb,"fantasy_player_game_stats","player_id,game_id,team_snapshot,position_snapshot,did_play,goals,assists,shots,plus_minus,pim,saves,goals_against,minutes_played,win,shutout",playerIds),
      fetchByPlayerIds(sb,"fantasy_player_points","id,player_id,game_id,actual_points,calculated_at",playerIds),
    ]);

    const histGameMap=new Map((histGames||[]).map((g:any)=>[String(g.id),g]));
    const currentGameMap=new Map((currentGames||[]).map((g:any)=>[String(g.id),g]));
    const priceMap=new Map((prices||[]).map((p:any)=>[String(p.player_id),Number(p.price||0)]));
    const preMap=new Map(preseasonRows.map((p:any)=>[String(p.player_id),p]));

    const historyByPlayer=new Map<string,any[]>();
    for(const s of historicalStats){
      const p=preMap.get(String(s.player_id));if(!p)continue;
      const g=histGameMap.get(String(s.game_id));if(!g)continue;
      const pts=fantasyPoints(s,String(p.player_position||"W"));if(pts===null)continue;
      const arr=historyByPlayer.get(String(s.player_id))||[];
      arr.push({points:pts,startsAt:new Date(g.starts_at).getTime(),home:g.home_team,away:g.away_team,statTeam:s.team_snapshot||p.team});
      historyByPlayer.set(String(s.player_id),arr);
    }
    for(const arr of historyByPlayer.values())arr.sort((a,b)=>a.startsAt-b.startsAt);

    // Position price prior, target-only. Used only for players without usable 2025/26 data.
    const priorRatios=new Map<string,number[]>();
    for(const p of preseasonRows){
      const id=String(p.player_id),hist=historyByPlayer.get(id)||[],price=priceMap.get(id)||0;
      if(hist.length<5||price<=0)continue;
      const pos=["C","W","F"].includes(String(p.player_position))?"F":String(p.player_position);
      const list=priorRatios.get(pos)||[];list.push(avg(hist.map(x=>x.points))/price);priorRatios.set(pos,list);
    }
    function median(values:number[]){if(!values.length)return 0;const x=[...values].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}

    // De-duplicate current points by player/game, keeping latest calculated row.
    const currentLatest=new Map<string,any>();
    for(const r of currentPoints){
      if(!currentGameMap.has(String(r.game_id)))continue;
      const key=`${r.player_id}:${r.game_id}`,old=currentLatest.get(key);
      if(!old||String(r.calculated_at||"")>String(old.calculated_at||""))currentLatest.set(key,r);
    }
    const currentByPlayer=new Map<string,any[]>();
    for(const r of currentLatest.values()){
      const g=currentGameMap.get(String(r.game_id));if(!g)continue;
      const arr=currentByPlayer.get(String(r.player_id))||[];
      arr.push({points:Number(r.actual_points||0),startsAt:new Date(g.starts_at).getTime(),home:g.home_team,away:g.away_team});currentByPlayer.set(String(r.player_id),arr);
    }
    for(const arr of currentByPlayer.values())arr.sort((a,b)=>a.startsAt-b.startsAt);

    // Live opponent data for gradual preseason -> current-season factor transition.
    const finished=(currentGames||[]).filter((g:any)=>g.home_score!==null&&g.away_score!==null);
    const leagueGoals:number[]=[];const teamResults=new Map<string,{gf:number,ga:number}[]>();
    for(const g of finished){
      const hs=Number(g.home_score),as=Number(g.away_score);leagueGoals.push(hs,as);
      const hk=teamKey(g.home_team),ak=teamKey(g.away_team);
      const h=teamResults.get(hk)||[];h.push({gf:hs,ga:as});teamResults.set(hk,h);
      const a=teamResults.get(ak)||[];a.push({gf:as,ga:hs});teamResults.set(ak,a);
    }
    const leagueAvg=avg(leagueGoals);
    function opponentFactor(opponent:string,position:string){
      const pre=preseasonOpponentFactor(opponent),results=teamResults.get(teamKey(opponent))||[];
      if(!results.length||leagueAvg<=0)return pre;
      const gf=avg(results.map(x=>x.gf)),ga=avg(results.map(x=>x.ga));
      let live=1;
      if(position==="G")live=gf>0?Math.pow(leagueAvg/gf,1.15):1.35;
      else live=Math.pow(ga/leagueAvg,1.15);
      live=clamp(live,.70,1.35);
      const liveWeight=Math.min(1,results.length/12);
      return clamp((1-liveWeight)*pre+liveWeight*live,.70,1.35);
    }

    const now=Date.now();
    const sw=Number(settings?.season_weight??.5),fw=Number(settings?.form_weight??.3),vw=Number(settings?.venue_weight??.1),ow=Number(settings?.opponent_weight??.1);

    const rows=preseasonRows.map((p:any)=>{
      const id=String(p.player_id),team=String(p.team||""),pos=String(p.player_position||"W"),hist=historyByPlayer.get(id)||[],cur=currentByPlayer.get(id)||[],price=priceMap.get(id)||0;
      const posGroup=["C","W","F"].includes(pos)?"F":pos;
      const fallback=price*median(priorRatios.get(posGroup)||[]);
      const histSeason=hist.length?avg(hist.map(x=>x.points)):fallback;
      const histForm=hist.length?avg(hist.slice(-5).map(x=>x.points)):histSeason;
      const histHome=hist.filter(x=>teamKey(x.home)===teamKey(x.statTeam));
      const histAway=hist.filter(x=>teamKey(x.away)===teamKey(x.statTeam));
      const priorHome=histHome.length?avg(histHome.map(x=>x.points)):histSeason;
      const priorAway=histAway.length?avg(histAway.map(x=>x.points)):histSeason;
      const currentWeight=Math.min(1,cur.length/10);
      const curSeason=cur.length?avg(cur.map(x=>x.points)):histSeason;
      const curForm=cur.length?avg(cur.slice(-5).map(x=>x.points)):curSeason;
      const curHome=cur.filter(x=>teamKey(x.home)===teamKey(team));
      const curAway=cur.filter(x=>teamKey(x.away)===teamKey(team));
      const seasonPpg=(1-currentWeight)*histSeason+currentWeight*curSeason;
      const formPpg=(1-currentWeight)*histForm+currentWeight*curForm;
      const homePpg=(1-currentWeight)*priorHome+currentWeight*(curHome.length?avg(curHome.map(x=>x.points)):curSeason);
      const awayPpg=(1-currentWeight)*priorAway+currentWeight*(curAway.length?avg(curAway.map(x=>x.points)):curSeason);
      const fixture=(currentGames||[]).filter((g:any)=>new Date(g.starts_at).getTime()>now&&!['finished','cancelled'].includes(String(g.status||'scheduled'))&&(teamKey(g.home_team)===teamKey(team)||teamKey(g.away_team)===teamKey(team))).sort((a:any,b:any)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime())[0];
      const isHome=fixture?teamKey(fixture.home_team)===teamKey(team):false;
      const opponent=fixture?(isHome?fixture.away_team:fixture.home_team):"";
      const factor=fixture?opponentFactor(opponent,pos):1;
      const baseline=fixture?sw*seasonPpg+fw*formPpg+vw*(isHome?homePpg:awayPpg)+ow*(seasonPpg*factor):seasonPpg;
      const preseason=Number(p.preseason_ppg||0),weight=Number(p.preseason_weight||0),adjustment=(preseason-baseline)*weight;
      return {
        player_id:p.player_id,player_name:p.player_name,team:p.team,player_position:p.player_position,
        baseline_xfp:Number(baseline.toFixed(2)),preseason_ppg:Number(preseason.toFixed(2)),preseason_games:Number(p.preseason_games||0),preseason_weight:weight,
        preseason_adjustment:Number(adjustment.toFixed(2)),preview_xfp:Number((baseline+adjustment).toFixed(2)),avg_opponent_factor:Number(p.avg_opponent_factor||0),avg_data_weight:Number(p.avg_data_weight||0),regular_games:Number(p.regular_games||0),data_confidence:p.data_confidence||"low",
      };
    }).sort((a:any,b:any)=>b.preview_xfp-a.preview_xfp||String(a.player_name).localeCompare(String(b.player_name),"nb"));

    return NextResponse.json({ok:true,rows,source:"server-baseline",players:playerIds.length});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Kunne ikke beregne preseason-preview",source:"server-baseline"},{status:500});
  }
}
