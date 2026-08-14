import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Pos="G"|"D"|"F";
type XfpRow={player_id:string;player_name:string;team:string;player_position:string;price:number|string;xfp_next_game:number|string;xfp_next3:number|string};
type Player={id:string;name:string;team:string;pos:Pos;price:number;score:number;available:boolean};
type Change={out:Player;in:Player};

function clientFor(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}
function pos(v:string):Pos|null{if(v==="G")return"G";if(v==="D")return"D";if(v==="C"||v==="W"||v==="F")return"F";return null}
function round(v:number,d=2){const p=10**d;return Math.round(v*p)/p}
function validRoster(players:Player[],budget:number){
  if(players.length!==12)return false;
  if(players.filter(p=>p.pos==="G").length!==2||players.filter(p=>p.pos==="D").length!==4||players.filter(p=>p.pos==="F").length!==6)return false;
  if(players.reduce((s,p)=>s+p.price,0)>budget+1e-9)return false;
  const clubs=new Map<string,number>();
  for(const p of players){const n=(clubs.get(p.team)||0)+1;if(n>3)return false;clubs.set(p.team,n)}
  return true;
}
function combinations<T>(arr:T[],k:number):T[][]{
  if(k===0)return[[]];
  const out:T[][]=[];
  const walk=(start:number,chosen:T[])=>{if(chosen.length===k){out.push([...chosen]);return}for(let i=start;i<=arr.length-(k-chosen.length);i++){chosen.push(arr[i]);walk(i+1,chosen);chosen.pop()}};
  walk(0,[]);return out;
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  const sb=clientFor(request);if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  const horizon=request.nextUrl.searchParams.get("horizon")||"next3";
  if(!["next_game","next3"].includes(horizon))return NextResponse.json({ok:false,error:"Ugyldig horisont."},{status:400});

  const[{data:team,error:teamError},{data:status,error:statusError},{data:xfp,error:xfpError},{data:availability,error:availabilityError},{data:economy,error:economyError}]=await Promise.all([
    sb.from("fantasy_user_teams").select("id,name").eq("season","2026/27").maybeSingle(),
    sb.rpc("get_fantasy_transfer_status_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_xfp_admin_v1",{p_season:"2026/27"}),
    sb.from("fantasy_players").select("id,active,on_current_roster,available_for_purchase"),
    sb.rpc("get_fantasy_economy_admin_v1",{p_season:"2026/27"}),
  ]);
  if(teamError)return NextResponse.json({ok:false,error:teamError.message},{status:500});
  if(statusError)return NextResponse.json({ok:false,error:statusError.message},{status:500});
  if(xfpError)return NextResponse.json({ok:false,error:xfpError.message},{status:500});
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
  if(economyError)return NextResponse.json({ok:false,error:economyError.message},{status:500});
  if(!team?.id)return NextResponse.json({ok:true,team:null,status:status?.[0]||null,changes:[],current:[],optimized:[],message:"Fant ingen lag for innlogget bruker."});

  const{data:teamPlayers,error:tpError}=await sb.from("fantasy_user_team_players").select("player_id").eq("team_id",team.id);
  if(tpError)return NextResponse.json({ok:false,error:tpError.message},{status:500});
  const ids=new Set((teamPlayers||[]).map((r:any)=>r.player_id));
  const availabilityMap=new Map((availability||[]).map((r:any)=>[r.id,r]));
  const all=((xfp||[]) as XfpRow[]).flatMap(r=>{
    const p=pos(r.player_position),price=Number(r.price),score=Number(horizon==="next_game"?r.xfp_next_game:r.xfp_next3);if(!p||!Number.isFinite(price)||price<=0||!Number.isFinite(score))return[];
    const a:any=availabilityMap.get(r.player_id);
    return[{id:r.player_id,name:r.player_name,team:r.team,pos:p,price,score,available:Boolean(a?.active&&a?.on_current_roster&&a?.available_for_purchase!==false)} satisfies Player];
  });
  const byId=new Map(all.map(p=>[p.id,p]));
  const current=[...ids].map(id=>byId.get(id)).filter(Boolean) as Player[];
  if(current.length!==12)return NextResponse.json({ok:true,team,status:status?.[0]||null,changes:[],current,optimized:current,message:`Laget har ${current.length}/12 spillere og kan ikke bytteoptimaliseres ennå.`});

  const statusRow:any=status?.[0]||{};
  const remaining=Math.max(0,Math.min(2,Number(statusRow.transfers_remaining??2)));
  const budget=Number(economy?.[0]?.budget||100);
  const currentCost=current.reduce((s,p)=>s+p.price,0),currentScore=current.reduce((s,p)=>s+p.score,0);
  let best={roster:current,score:currentScore,cost:currentCost,changes:[] as Change[]};
  const incomingPool=all.filter(p=>p.available&&!ids.has(p.id));

  for(let k=1;k<=remaining;k++){
    for(const outs of combinations(current,k)){
      const kept=current.filter(p=>!outs.some(o=>o.id===p.id));
      const need={G:outs.filter(p=>p.pos==="G").length,D:outs.filter(p=>p.pos==="D").length,F:outs.filter(p=>p.pos==="F").length};
      const candidateLists:{pos:Pos;count:number;players:Player[]}[]=(Object.keys(need) as Pos[]).filter(p=>need[p]>0).map(p=>({pos:p,count:need[p],players:incomingPool.filter(x=>x.pos===p)}));
      let incomingCombos:Player[][]=[[]];
      for(const spec of candidateLists){
        const combos=combinations(spec.players,spec.count);
        const next:Player[][]=[];
        for(const base of incomingCombos)for(const add of combos)next.push([...base,...add]);
        incomingCombos=next;
      }
      for(const ins of incomingCombos){
        if(new Set(ins.map(p=>p.id)).size!==k)continue;
        const roster=[...kept,...ins];if(!validRoster(roster,budget))continue;
        const score=roster.reduce((s,p)=>s+p.score,0),cost=roster.reduce((s,p)=>s+p.price,0);
        if(score>best.score+1e-9||(Math.abs(score-best.score)<1e-9&&cost<best.cost)){
          const changes:Change[]=[];
          for(const p of ["G","D","F"] as Pos[]){const o=outs.filter(x=>x.pos===p).sort((a,b)=>a.score-b.score),ii=ins.filter(x=>x.pos===p).sort((a,b)=>b.score-a.score);for(let i=0;i<Math.min(o.length,ii.length);i++)changes.push({out:o[i],in:ii[i]})}
          best={roster,score,cost,changes};
        }
      }
    }
  }

  return NextResponse.json({
    ok:true,team,status:statusRow,economy:economy?.[0]||null,horizon,
    current:current.map(p=>({...p,score:round(p.score)})),
    optimized:best.roster.map(p=>({...p,score:round(p.score)})),
    changes:best.changes.map(c=>({out:{...c.out,score:round(c.out.score)},in:{...c.in,score:round(c.in.score)},price_change:round(c.in.price-c.out.price,1),xfp_gain:round(c.in.score-c.out.score)})),
    current_cost:round(currentCost,1),optimized_cost:round(best.cost,1),current_score:round(currentScore),optimized_score:round(best.score),xfp_gain:round(best.score-currentScore),transfers_available:remaining,
  });
}
