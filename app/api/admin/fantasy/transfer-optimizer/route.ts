import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {isOptimizerEligibleAvailability} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Pos="G"|"D"|"F";
type XfpRow={player_id:string;player_name:string;team:string;player_position:string;price:number|string;base_xfp_next_game:number|string;base_xfp_next3_rounds:number|string};
type Player={id:string;name:string;team:string;pos:Pos;price:number;base_score:number;score:number;available:boolean;availability_status:string;line_no:number|null;is_captain:boolean;is_vice_captain:boolean};
type Change={out:Player;in:Player};
type TeamPlayerRow={player_id:string;purchase_price:number|string|null;line_no:number|null;is_captain:boolean|null;is_vice_captain:boolean|null};
type CatalogRow={id:string;name:string;team:string;position:string;price:number|string|null;active:boolean;on_current_roster:boolean;available_for_purchase:boolean|null};

function userClient(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}
function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function pos(v:string):Pos|null{if(v==="G")return"G";if(v==="D")return"D";if(v==="C"||v==="W"||v==="F")return"F";return null}
function round(v:number,d=2){const p=10**d;return Math.round(v*p)/p}
function lineMultiplier(lineNo:number|null){return lineNo===2?0.5:1}
function roleMultiplier(p:Player){return p.is_captain?2:p.is_vice_captain?1.5:1}
function effectiveScore(p:Player){return p.base_score*lineMultiplier(p.line_no)*roleMultiplier(p)}
function withEffectiveScore(p:Player):Player{return{...p,score:effectiveScore(p)}}
function validRoster(players:Player[],budget:number){
  if(players.length!==12)return false;
  if(players.filter(p=>p.pos==="G").length!==2||players.filter(p=>p.pos==="D").length!==4||players.filter(p=>p.pos==="F").length!==6)return false;
  if(players.reduce((s,p)=>s+p.price,0)>budget+1e-9)return false;
  const clubs=new Map<string,number>();
  for(const p of players){const n=(clubs.get(p.team)||0)+1;if(n>3)return false;clubs.set(p.team,n)}
  return true;
}
function validLineup(players:Player[]){
  if(players.length!==12)return false;
  for(const n of [1,2]){
    const line=players.filter(p=>p.line_no===n);
    if(line.length!==6||line.filter(p=>p.pos==="G").length!==1||line.filter(p=>p.pos==="D").length!==2||line.filter(p=>p.pos==="F").length!==3)return false;
  }
  return true;
}
function optimizeLineup(players:Player[]){
  if(players.length!==12)return players.map(withEffectiveScore);
  const line1Ids=new Set<string>();
  for(const [position,count] of [["G",1],["D",2],["F",3]] as const){
    const ranked=players.filter(p=>p.pos===position).sort((a,b)=>b.base_score*roleMultiplier(b)-a.base_score*roleMultiplier(a)||a.price-b.price||a.name.localeCompare(b.name,"nb"));
    ranked.slice(0,count).forEach(p=>line1Ids.add(p.id));
  }
  return players.map(p=>withEffectiveScore({...p,line_no:line1Ids.has(p.id)?1:2}));
}
function combinations<T>(arr:T[],k:number):T[][]{
  if(k===0)return[[]];
  const out:T[][]=[];
  const walk=(start:number,chosen:T[])=>{if(chosen.length===k){out.push([...chosen]);return}for(let i=start;i<=arr.length-(k-chosen.length);i++){chosen.push(arr[i]);walk(i+1,chosen);chosen.pop()}};
  walk(0,[]);return out;
}
function pairPlayers(outs:Player[],ins:Player[]){
  const pairs:{out:Player;in:Player}[]=[];
  for(const p of ["G","D","F"] as Pos[]){
    const outgoing=outs.filter(x=>x.pos===p).sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,"nb"));
    const incoming=ins.filter(x=>x.pos===p).sort((a,b)=>b.base_score-a.base_score||a.price-b.price);
    for(let i=0;i<Math.min(outgoing.length,incoming.length);i++)pairs.push({out:outgoing[i],in:incoming[i]});
  }
  return pairs;
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  const sb=userClient(request),server=adminClient();
  if(!sb||!server)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  const horizon=request.nextUrl.searchParams.get("horizon")||"next3";
  if(!["next_game","next3"].includes(horizon))return NextResponse.json({ok:false,error:"Ugyldig horisont."},{status:400});

  const[{data:team,error:teamError},{data:status,error:statusError},{data:xfp,error:xfpError},{data:economy,error:economyError},{data:catalog,error:catalogError},{data:availability,error:availabilityError}]=await Promise.all([
    sb.from("fantasy_user_teams").select("id,name").eq("season","2026/27").maybeSingle(),
    sb.rpc("get_fantasy_transfer_status_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_xfp_round_horizons_admin_v2",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_economy_admin_v1",{p_season:"2026/27"}),
    server.from("fantasy_players").select("id,name,team,position,price,active,on_current_roster,available_for_purchase"),
    server.from("fantasy_player_availability").select("player_id,status"),
  ]);
  if(teamError)return NextResponse.json({ok:false,error:teamError.message},{status:500});
  if(statusError)return NextResponse.json({ok:false,error:statusError.message},{status:500});
  if(xfpError)return NextResponse.json({ok:false,error:xfpError.message},{status:500});
  if(economyError)return NextResponse.json({ok:false,error:economyError.message},{status:500});
  if(catalogError)return NextResponse.json({ok:false,error:catalogError.message},{status:500});
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
  if(!team?.id)return NextResponse.json({ok:true,team:null,status:status?.[0]||null,changes:[],current:[],optimized:[],message:"Fant ingen lag for innlogget bruker."});

  const{data:teamPlayers,error:tpError}=await sb.from("fantasy_user_team_players").select("player_id,purchase_price,line_no,is_captain,is_vice_captain").eq("team_id",team.id);
  if(tpError)return NextResponse.json({ok:false,error:tpError.message},{status:500});

  const teamRows=(teamPlayers||[]) as TeamPlayerRow[];
  const ids=new Set(teamRows.map(r=>r.player_id));
  const xfpMap=new Map<string,XfpRow>(((xfp||[]) as XfpRow[]).map(r=>[r.player_id,r]));
  const catalogMap=new Map<string,CatalogRow>(((catalog||[]) as CatalogRow[]).map(r=>[r.id,r]));
  const availabilityMap=new Map<string,string>(((availability||[]) as any[]).map(r=>[r.player_id,String(r.status||"available")]));

  const buildPlayer=(c:CatalogRow,teamMeta?:TeamPlayerRow):Player|null=>{
    const position=pos(c.position);if(!position)return null;
    const xr=xfpMap.get(c.id);
    const fallbackPrice=Number(c.price||0),xfpPrice=Number(xr?.price||0),purchasePrice=Number(teamMeta?.purchase_price||0);
    const price=teamMeta&&Number.isFinite(purchasePrice)&&purchasePrice>0?purchasePrice:(Number.isFinite(xfpPrice)&&xfpPrice>0?xfpPrice:fallbackPrice);
    if(!Number.isFinite(price)||price<=0)return null;
    const baseScore=Number(horizon==="next_game"?xr?.base_xfp_next_game??0:xr?.base_xfp_next3_rounds??0);
    const availabilityStatus=availabilityMap.get(c.id)||"available";
    const player:Player={id:c.id,name:c.name,team:c.team,pos:position,price,base_score:Number.isFinite(baseScore)?baseScore:0,score:0,available:Boolean(c.active&&c.on_current_roster&&c.available_for_purchase!==false&&isOptimizerEligibleAvailability(availabilityStatus)),availability_status:availabilityStatus,line_no:teamMeta?.line_no??null,is_captain:Boolean(teamMeta?.is_captain),is_vice_captain:Boolean(teamMeta?.is_vice_captain)};
    return withEffectiveScore(player);
  };

  const storedCurrent=teamRows.map(meta=>{const c=catalogMap.get(meta.player_id);return c?buildPlayer(c,meta):null}).filter(Boolean) as Player[];
  if(storedCurrent.length!==teamRows.length)return NextResponse.json({ok:false,error:`Kunne ikke speile hele fantasy-laget: ${storedCurrent.length}/${teamRows.length} spillere ble funnet i aktiv spillerkatalog.`},{status:500});
  if(storedCurrent.length!==12)return NextResponse.json({ok:true,team,status:status?.[0]||null,changes:[],current:storedCurrent,optimized:storedCurrent,message:`Det faktiske Fantasy-laget inneholder ${storedCurrent.length}/12 spillere. Laget må være komplett før bytter kan optimaliseres.`});

  const storedLineupValid=validLineup(storedCurrent);
  const current=storedLineupValid?storedCurrent.map(withEffectiveScore):optimizeLineup(storedCurrent);
  const all=((catalog||[]) as CatalogRow[]).map(c=>buildPlayer(c)).filter(Boolean) as Player[];
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
        const pairs=pairPlayers(outs,ins);
        const replacements=pairs.map(({out,in:incoming})=>({...incoming,is_captain:out.is_captain,is_vice_captain:out.is_vice_captain}));
        const unassigned=[...kept,...replacements].map(p=>({...p,line_no:null,score:0}));
        if(!validRoster(unassigned,budget))continue;
        const roster=optimizeLineup(unassigned);
        const score=roster.reduce((s,p)=>s+p.score,0),cost=roster.reduce((s,p)=>s+p.price,0);
        if(score>best.score+1e-9||(Math.abs(score-best.score)<1e-9&&cost<best.cost)){
          const finalById=new Map(roster.map(p=>[p.id,p]));
          best={roster,score,cost,changes:pairs.map(({out,in:incoming})=>({out,in:finalById.get(incoming.id)!}))};
        }
      }
    }
  }

  const serialize=(p:Player)=>({...p,base_score:round(p.base_score),score:round(p.score),price:round(p.price,1),line_multiplier:lineMultiplier(p.line_no),role_multiplier:roleMultiplier(p)});
  return NextResponse.json({
    ok:true,team,status:statusRow,economy:economy?.[0]||null,horizon,
    current:current.map(serialize),
    optimized:best.roster.map(serialize),
    changes:best.changes.map(c=>({out:serialize(c.out),in:serialize(c.in),line_no:c.in.line_no,price_change:round(c.in.price-c.out.price,1),xfp_gain:round(c.in.score-c.out.score)})),
    current_cost:round(currentCost,1),optimized_cost:round(best.cost,1),current_score:round(currentScore),optimized_score:round(best.score),xfp_gain:round(best.score-currentScore),transfers_available:remaining,
    lineup_policy:{line1_multiplier:1,line2_multiplier:0.5,line_shape:"1G · 2D · 3F per rekke",stored_lineup_valid:storedLineupValid,analysis_lineup:storedLineupValid?"stored":"optimized_valid_fallback"},
    availability_policy:{authoritative_source:"fantasy_player_availability",blocked_statuses:["out","long_term","not_in_lineup"]},
    message:storedLineupValid?undefined:"Lagrede rekkedata var ugyldige. Analysen bruker derfor en gyldig 1G · 2D · 3F-fordeling per rekke og viser hvilke rekker som bør lagres.",
  });
}
