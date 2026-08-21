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

type XfpRow={
  player_id:string;
  player_name:string;
  team:string;
  player_position:string;
  price:number|string;
  xfp_next_game:number|string;
  xfp_next3:number|string;
};

type Player={
  player_id:string;
  player_name:string;
  team:string;
  pos:"G"|"D"|"F";
  price:number;
  score:number;
  availability_status:string;
};

type State={
  picks:Player[];
  cost:number;
  score:number;
  clubs:Record<string,number>;
  nextIndex:number;
};

const SLOTS:{pos:"G"|"D"|"F";count:number}[]=[
  {pos:"G",count:2},
  {pos:"D",count:4},
  {pos:"F",count:6},
];

function canonicalPosition(value:string):"G"|"D"|"F"|null{
  if(value==="G")return "G";
  if(value==="D")return "D";
  if(value==="C"||value==="W"||value==="F")return "F";
  return null;
}

function candidatePool(players:Player[],pos:"G"|"D"|"F"){
  const source=players.filter(p=>p.pos===pos);
  const byScore=[...source].sort((a,b)=>b.score-a.score||a.price-b.price).slice(0,pos==="F"?34:pos==="D"?28:18);
  const byValue=[...source].sort((a,b)=>(b.score/b.price)-(a.score/a.price)||b.score-a.score).slice(0,pos==="F"?28:22);
  const byCheap=[...source].sort((a,b)=>a.price-b.price||b.score-a.score).slice(0,pos==="F"?18:14);
  const map=new Map<string,Player>();
  for(const p of [...byScore,...byValue,...byCheap])map.set(p.player_id,p);
  return Array.from(map.values()).sort((a,b)=>b.score-a.score||a.price-b.price);
}

function trimBeam(states:State[],budget:number,width=9000){
  if(states.length<=width)return states;
  const dedupe=new Map<string,State>();
  const keep=(s:State)=>{const key=`${Math.round(s.cost*100)}|${Object.entries(s.clubs).sort().map(([k,v])=>`${k}:${v}`).join(",")}|${s.nextIndex}`;const old=dedupe.get(key);if(!old||s.score>old.score)dedupe.set(key,s)};

  const byScore=[...states].sort((a,b)=>b.score-a.score||a.cost-b.cost).slice(0,Math.floor(width*.58));
  const byValue=[...states].sort((a,b)=>(b.score/Math.max(b.cost,1))-(a.score/Math.max(a.cost,1))||b.score-a.score).slice(0,Math.floor(width*.25));
  const byCheap=[...states].sort((a,b)=>a.cost-b.cost||b.score-a.score).slice(0,Math.floor(width*.17));
  for(const s of [...byScore,...byValue,...byCheap])keep(s);
  return Array.from(dedupe.values()).slice(0,width);
}

function choosePosition(base:State[],pool:Player[],count:number,budget:number){
  let states=base.map(s=>({...s,nextIndex:0}));
  for(let slot=0;slot<count;slot++){
    const next:State[]=[];
    for(const state of states){
      for(let i=state.nextIndex;i<pool.length;i++){
        const p=pool[i];
        const cost=state.cost+p.price;
        if(cost>budget+1e-9)continue;
        const clubCount=state.clubs[p.team]||0;
        if(clubCount>=3)continue;
        next.push({
          picks:[...state.picks,p],
          cost,
          score:state.score+p.score,
          clubs:{...state.clubs,[p.team]:clubCount+1},
          nextIndex:i+1,
        });
      }
    }
    if(!next.length)return [];
    states=trimBeam(next,budget);
  }
  return states.map(s=>({...s,nextIndex:0}));
}

function optimize(players:Player[],budget:number){
  let states:State[]=[{picks:[],cost:0,score:0,clubs:{},nextIndex:0}];
  for(const slot of SLOTS){
    const pool=candidatePool(players,slot.pos);
    if(pool.length<slot.count)return null;
    states=choosePosition(states,pool,slot.count,budget);
    if(!states.length)return null;
  }
  states.sort((a,b)=>b.score-a.score||a.cost-b.cost);
  return states[0]||null;
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const userSb=userClientFor(request);
  const serviceSb=serviceClient();
  if(!userSb||!serviceSb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});

  const horizon=request.nextUrl.searchParams.get("horizon")||"next3";
  if(!["next_game","next3"].includes(horizon))return NextResponse.json({ok:false,error:"Ugyldig horisont."},{status:400});

  const budgetRaw=request.nextUrl.searchParams.get("budget");
  const requestedBudget=budgetRaw===null||budgetRaw===""?null:Number(budgetRaw);
  if(requestedBudget!==null&&(!Number.isFinite(requestedBudget)||requestedBudget<=0||requestedBudget>500))return NextResponse.json({ok:false,error:"Ugyldig budsjett."},{status:400});

  const[{data:economy,error:economyError},{data:xfp,error:xfpError},{data:purchase,error:purchaseError},{data:approvedAvailability,error:approvedAvailabilityError}]=await Promise.all([
    userSb.rpc("get_fantasy_economy_admin_v1",{p_season:"2026/27"}),
    userSb.rpc("get_fantasy_xfp_admin_v1",{p_season:"2026/27"}),
    serviceSb.from("fantasy_players").select("id,active,on_current_roster,available_for_purchase"),
    serviceSb.from("fantasy_player_availability").select("player_id,status"),
  ]);

  if(economyError)return NextResponse.json({ok:false,error:economyError.message},{status:500});
  if(xfpError)return NextResponse.json({ok:false,error:xfpError.message},{status:500});
  if(purchaseError)return NextResponse.json({ok:false,error:purchaseError.message},{status:500});
  if(approvedAvailabilityError)return NextResponse.json({ok:false,error:approvedAvailabilityError.message},{status:500});

  const economyRow=economy?.[0]||null;
  const budget=requestedBudget??Number(economyRow?.budget||100);
  const purchaseAllowed=new Set((purchase||[]).filter((p:any)=>p.active&&p.on_current_roster&&p.available_for_purchase!==false).map((p:any)=>p.id));
  const availabilityMap=new Map<string,string>((approvedAvailability||[]).map((r:any)=>[r.player_id,String(r.status||"available")]));
  const excludedByAvailability=((approvedAvailability||[]) as any[]).filter(r=>!isOptimizerEligibleAvailability(r.status)).map(r=>({player_id:r.player_id,status:r.status,reason:availabilityEligibilityReason(r.status)}));

  const players=((xfp||[]) as XfpRow[]).flatMap((r)=>{
    if(!purchaseAllowed.has(r.player_id))return [];
    const availabilityStatus=availabilityMap.get(r.player_id)||"available";
    if(!isOptimizerEligibleAvailability(availabilityStatus))return [];
    const pos=canonicalPosition(r.player_position);
    const price=Number(r.price);
    const score=Number(horizon==="next_game"?r.xfp_next_game:r.xfp_next3);
    if(!pos||!Number.isFinite(price)||price<=0||!Number.isFinite(score))return [];
    return [{player_id:r.player_id,player_name:r.player_name,team:r.team,pos,price,score,availability_status:availabilityStatus} satisfies Player];
  });

  const best=optimize(players,budget);
  if(!best)return NextResponse.json({ok:true,economy:economyRow,rows:[],availability_policy:{authoritative_source:"fantasy_player_availability",blocked_statuses:["out","long_term","not_in_lineup"],excluded:excludedByAvailability}});

  const totalCost=Math.round(best.cost*100)/100;
  const totalProjected=Math.round(best.score*100)/100;
  const rows=best.picks.map(p=>({
    player_id:p.player_id,
    player_name:p.player_name,
    team:p.team,
    player_position:p.pos,
    price:p.price,
    projected_points:Math.round(p.score*100)/100,
    availability_status:p.availability_status,
    total_cost:totalCost,
    total_projected_points:totalProjected,
  }));

  return NextResponse.json({ok:true,economy:economyRow,rows,availability_policy:{authoritative_source:"fantasy_player_availability",blocked_statuses:["out","long_term","not_in_lineup"],excluded:excludedByAvailability}});
}
