import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityEligibilityReason,isOptimizerEligibleAvailability} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function userClientFor(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}
function serviceClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

type XfpRow={player_id:string;player_name:string;team:string;player_position:string;price:number|string;base_xfp_next_game:number|string;base_xfp_next3_rounds:number|string};
type Pos="G"|"D"|"F";
type Player={player_id:string;player_name:string;team:string;pos:Pos;price:number;base_score:number;availability_status:string};
type State={picks:Player[];cost:number;score:number;clubs:Record<string,number>;nextIndex:number};
type AssignedPlayer=Player&{line_no:1|2;is_captain:boolean;is_vice_captain:boolean;line_multiplier:number;role_multiplier:number;score:number};
type Evaluated={players:AssignedPlayer[];score:number};

const SLOTS:{pos:Pos;count:number}[]=[{pos:"G",count:2},{pos:"D",count:4},{pos:"F",count:6}];
function canonicalPosition(value:string):Pos|null{if(value==="G")return"G";if(value==="D")return"D";if(value==="C"||value==="W"||value==="F")return"F";return null}
function round(v:number,d=2){const p=10**d;return Math.round(v*p)/p}
function combinations<T>(arr:T[],k:number):T[][]{if(k===0)return[[]];const out:T[][]=[];const walk=(start:number,chosen:T[])=>{if(chosen.length===k){out.push([...chosen]);return}for(let i=start;i<=arr.length-(k-chosen.length);i++){chosen.push(arr[i]);walk(i+1,chosen);chosen.pop()}};walk(0,[]);return out}

function candidatePool(players:Player[],pos:Pos){
  const source=players.filter(p=>p.pos===pos);
  const byScore=[...source].sort((a,b)=>b.base_score-a.base_score||a.price-b.price).slice(0,pos==="F"?34:pos==="D"?28:18);
  const byValue=[...source].sort((a,b)=>(b.base_score/b.price)-(a.base_score/a.price)||b.base_score-a.base_score).slice(0,pos==="F"?28:22);
  const byCheap=[...source].sort((a,b)=>a.price-b.price||b.base_score-a.base_score).slice(0,pos==="F"?18:14);
  const map=new Map<string,Player>();for(const p of [...byScore,...byValue,...byCheap])map.set(p.player_id,p);
  return Array.from(map.values()).sort((a,b)=>b.base_score-a.base_score||a.price-b.price);
}
function trimBeam(states:State[],width=9000){
  if(states.length<=width)return states;
  const dedupe=new Map<string,State>();
  const keep=(s:State)=>{const key=`${Math.round(s.cost*100)}|${Object.entries(s.clubs).sort().map(([k,v])=>`${k}:${v}`).join(",")}|${s.nextIndex}`;const old=dedupe.get(key);if(!old||s.score>old.score)dedupe.set(key,s)};
  const byScore=[...states].sort((a,b)=>b.score-a.score||a.cost-b.cost).slice(0,Math.floor(width*.58));
  const byValue=[...states].sort((a,b)=>(b.score/Math.max(b.cost,1))-(a.score/Math.max(a.cost,1))||b.score-a.score).slice(0,Math.floor(width*.25));
  const byCheap=[...states].sort((a,b)=>a.cost-b.cost||b.score-a.score).slice(0,Math.floor(width*.17));
  for(const s of [...byScore,...byValue,...byCheap])keep(s);return Array.from(dedupe.values()).slice(0,width);
}
function choosePosition(base:State[],pool:Player[],count:number,budget:number){
  let states=base.map(s=>({...s,nextIndex:0}));
  for(let slot=0;slot<count;slot++){
    const next:State[]=[];
    for(const state of states)for(let i=state.nextIndex;i<pool.length;i++){
      const p=pool[i],cost=state.cost+p.price;if(cost>budget+1e-9)continue;
      const clubCount=state.clubs[p.team]||0;if(clubCount>=3)continue;
      next.push({picks:[...state.picks,p],cost,score:state.score+p.base_score,clubs:{...state.clubs,[p.team]:clubCount+1},nextIndex:i+1});
    }
    if(!next.length)return[];states=trimBeam(next);
  }
  return states.map(s=>({...s,nextIndex:0}));
}

function evaluateFantasy(picks:Player[]):Evaluated|null{
  if(picks.length!==12)return null;
  const gs=picks.filter(p=>p.pos==="G"),ds=picks.filter(p=>p.pos==="D"),fs=picks.filter(p=>p.pos==="F");
  if(gs.length!==2||ds.length!==4||fs.length!==6)return null;
  let best:Evaluated|null=null;
  for(const g1 of combinations(gs,1))for(const d1 of combinations(ds,2))for(const f1 of combinations(fs,3)){
    const line1=new Set([...g1,...d1,...f1].map(p=>p.player_id));
    const lineAdjusted=picks.map(p=>({p,line_no:(line1.has(p.player_id)?1:2) as 1|2,line_multiplier:line1.has(p.player_id)?1:0.5,line_score:p.base_score*(line1.has(p.player_id)?1:0.5)}));
    const ranked=[...lineAdjusted].sort((a,b)=>b.line_score-a.line_score||a.p.price-b.p.price||a.p.player_name.localeCompare(b.p.player_name,"nb"));
    const captainId=ranked[0]?.p.player_id,viceId=ranked[1]?.p.player_id;if(!captainId||!viceId)continue;
    const assigned:AssignedPlayer[]=lineAdjusted.map(x=>{
      const isCaptain=x.p.player_id===captainId,isVice=x.p.player_id===viceId,role=isCaptain?2:isVice?1.5:1;
      return{...x.p,line_no:x.line_no,is_captain:isCaptain,is_vice_captain:isVice,line_multiplier:x.line_multiplier,role_multiplier:role,score:x.line_score*role};
    });
    const score=assigned.reduce((s,p)=>s+p.score,0);
    if(!best||score>best.score+1e-9)best={players:assigned,score};
  }
  return best;
}

function optimize(players:Player[],budget:number){
  let states:State[]=[{picks:[],cost:0,score:0,clubs:{},nextIndex:0}];
  for(const slot of SLOTS){const pool=candidatePool(players,slot.pos);if(pool.length<slot.count)return null;states=choosePosition(states,pool,slot.count,budget);if(!states.length)return null}
  let best:{state:State;evaluated:Evaluated}|null=null;
  for(const state of states){const evaluated=evaluateFantasy(state.picks);if(!evaluated)continue;if(!best||evaluated.score>best.evaluated.score+1e-9||(Math.abs(evaluated.score-best.evaluated.score)<1e-9&&state.cost<best.state.cost))best={state,evaluated}}
  return best;
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  const userSb=userClientFor(request),serviceSb=serviceClient();if(!userSb||!serviceSb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  const horizon=request.nextUrl.searchParams.get("horizon")||"next3";if(!["next_game","next3"].includes(horizon))return NextResponse.json({ok:false,error:"Ugyldig horisont."},{status:400});
  const budgetRaw=request.nextUrl.searchParams.get("budget"),requestedBudget=budgetRaw===null||budgetRaw===""?null:Number(budgetRaw);if(requestedBudget!==null&&(!Number.isFinite(requestedBudget)||requestedBudget<=0||requestedBudget>500))return NextResponse.json({ok:false,error:"Ugyldig budsjett."},{status:400});
  const[{data:economy,error:economyError},{data:xfp,error:xfpError},{data:purchase,error:purchaseError},{data:approvedAvailability,error:approvedAvailabilityError}]=await Promise.all([
    userSb.rpc("get_fantasy_economy_admin_v1",{p_season:"2026/27"}),userSb.rpc("get_fantasy_xfp_round_horizons_admin_v2",{p_season:"2026/27"}),serviceSb.from("fantasy_players").select("id,active,on_current_roster,available_for_purchase"),serviceSb.from("fantasy_player_availability").select("player_id,status")]);
  if(economyError)return NextResponse.json({ok:false,error:economyError.message},{status:500});if(xfpError)return NextResponse.json({ok:false,error:xfpError.message},{status:500});if(purchaseError)return NextResponse.json({ok:false,error:purchaseError.message},{status:500});if(approvedAvailabilityError)return NextResponse.json({ok:false,error:approvedAvailabilityError.message},{status:500});
  const economyRow=economy?.[0]||null,budget=requestedBudget??Number(economyRow?.budget||100);
  const purchaseAllowed=new Set((purchase||[]).filter((p:any)=>p.active&&p.on_current_roster&&p.available_for_purchase!==false).map((p:any)=>p.id));
  const availabilityMap=new Map<string,string>((approvedAvailability||[]).map((r:any)=>[r.player_id,String(r.status||"available")]));
  const excludedByAvailability=((approvedAvailability||[]) as any[]).filter(r=>!isOptimizerEligibleAvailability(r.status)).map(r=>({player_id:r.player_id,status:r.status,reason:availabilityEligibilityReason(r.status)}));
  const players=((xfp||[]) as XfpRow[]).flatMap(r=>{if(!purchaseAllowed.has(r.player_id))return[];const availabilityStatus=availabilityMap.get(r.player_id)||"available";if(!isOptimizerEligibleAvailability(availabilityStatus))return[];const pos=canonicalPosition(r.player_position),price=Number(r.price),baseScore=Number(horizon==="next_game"?r.base_xfp_next_game:r.base_xfp_next3_rounds);if(!pos||!Number.isFinite(price)||price<=0||!Number.isFinite(baseScore))return[];return[{player_id:r.player_id,player_name:r.player_name,team:r.team,pos,price,base_score:baseScore,availability_status:availabilityStatus} satisfies Player]});
  const best=optimize(players,budget);if(!best)return NextResponse.json({ok:true,economy:economyRow,rows:[],lineup_policy:{line1_multiplier:1,line2_multiplier:0.5,captain_multiplier:2,vice_multiplier:1.5,line_shape:"1G · 2D · 3F per rekke"},availability_policy:{authoritative_source:"fantasy_player_availability",blocked_statuses:["out","long_term","not_in_lineup"],excluded:excludedByAvailability}});
  const totalCost=round(best.state.cost),totalProjected=round(best.evaluated.score);
  const rows=best.evaluated.players.map(p=>({player_id:p.player_id,player_name:p.player_name,team:p.team,player_position:p.pos,price:p.price,base_projected_points:round(p.base_score),projected_points:round(p.score),line_no:p.line_no,line_multiplier:p.line_multiplier,is_captain:p.is_captain,is_vice_captain:p.is_vice_captain,role_multiplier:p.role_multiplier,availability_status:p.availability_status,total_cost:totalCost,total_projected_points:totalProjected}));
  return NextResponse.json({ok:true,economy:economyRow,rows,lineup_policy:{line1_multiplier:1,line2_multiplier:0.5,captain_multiplier:2,vice_multiplier:1.5,line_shape:"1G · 2D · 3F per rekke",objective:"line- and role-adjusted xFP"},availability_policy:{authoritative_source:"fantasy_player_availability",blocked_statuses:["out","long_term","not_in_lineup"],excluded:excludedByAvailability}});
}
