import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityXfpFactor,isOptimizerEligibleAvailability,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Pos="G"|"D"|"F";
type Confidence="high"|"medium"|"low";
type StrategyKey="balanced"|"conservative"|"offensive";
type XfpRow={player_id:string;player_name:string;team:string;player_position:string;price:number|string;data_confidence:string;base_xfp_next_game:number|string;base_xfp_next3_rounds:number|string};
type Player={id:string;name:string;team:string;pos:Pos;price:number;raw_base_score:number;base_score:number;score:number;available:boolean;availability_status:string;data_confidence:Confidence;risk_score:number;risk_label:"Lav"|"Middels"|"Høy";line_no:number|null;is_captain:boolean;is_vice_captain:boolean};
type Change={out:Player;in:Player};
type Candidate={roster:Player[];score:number;cost:number;changes:Change[]};
type TeamPlayerRow={player_id:string;purchase_price:number|string|null;line_no:number|null;is_captain:boolean|null;is_vice_captain:boolean|null};
type CatalogRow={id:string;name:string;team:string;position:string;price:number|string|null;active:boolean;on_current_roster:boolean;available_for_purchase:boolean|null};

const STRATEGIES:Record<StrategyKey,{label:string;description:string;riskPenalty:number;upsideWeight:number}>={
  balanced:{label:"Balansert",description:"Vekter forventet Fantasy-xFP høyest, men trekker moderat for risiko i foreslåtte INN-spillere.",riskPenalty:.18,upsideWeight:.05},
  conservative:{label:"Konservativ",description:"Straffer usikker availability og lav datatillit tydeligere, og foretrekker stabile forslag når forventningen er nær.",riskPenalty:.62,upsideWeight:0},
  offensive:{label:"Offensiv",description:"Vekter forventet Fantasy-xFP høyest og gir ekstra verdi til modellert oppside når usikkerheten kan gi et høyere tak.",riskPenalty:.05,upsideWeight:.30},
};

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
function confidence(v:string|null|undefined):Confidence{return v==="high"?"high":v==="low"?"low":"medium"}
function round(v:number,d=2){const p=10**d;return Math.round(v*p)/p}
function lineMultiplier(lineNo:number|null){return lineNo===2?0.5:1}
function roleMultiplier(p:Player){return p.is_captain?2:p.is_vice_captain?1.5:1}
function effectiveScore(p:Player){return p.base_score*lineMultiplier(p.line_no)*roleMultiplier(p)}
function rawEffectiveScore(p:Player){return p.raw_base_score*lineMultiplier(p.line_no)*roleMultiplier(p)}
function withEffectiveScore(p:Player):Player{return{...p,score:effectiveScore(p)}}
function playerRisk(status:string,dataConfidence:Confidence){
  const normalized=normalizeFantasyAvailabilityStatus(status);
  const availabilityRisk=normalized==="questionable"?45:normalized==="returning"?20:normalized==="available"?0:100;
  const confidenceRisk=dataConfidence==="low"?30:dataConfidence==="medium"?15:0;
  const score=Math.min(100,availabilityRisk+confidenceRisk);
  const label:Player["risk_label"]=score>35?"Høy":score>15?"Middels":"Lav";
  return{score,label};
}
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
function proposalRisk(changes:Change[]){
  if(!changes.length)return{score:0,label:"Lav" as const};
  const incoming=changes.map(c=>c.in.risk_score);
  const average=incoming.reduce((s,v)=>s+v,0)/incoming.length;
  const max=Math.max(...incoming);
  const score=Math.round(average*.65+max*.35);
  const label=score>35?"Høy":score>15?"Middels":"Lav";
  return{score,label};
}
function confidenceUpsideFactor(v:Confidence){return v==="low"?.16:v==="medium"?.07:0}
function modeledUpside(changes:Change[]){
  return changes.reduce((sum,c)=>{
    const raw=Math.max(0,rawEffectiveScore(c.in));
    const availabilityGap=Math.max(0,raw-c.in.score);
    const confidenceBand=raw*confidenceUpsideFactor(c.in.data_confidence);
    return sum+availabilityGap+confidenceBand;
  },0);
}
function incomingRiskCost(changes:Change[]){
  return changes.reduce((sum,c)=>sum+Math.max(0,c.in.score)*(c.in.risk_score/100),0);
}
function strategyUtility(candidate:Candidate,key:StrategyKey){
  const cfg=STRATEGIES[key];
  return candidate.score-incomingRiskCost(candidate.changes)*cfg.riskPenalty+modeledUpside(candidate.changes)*cfg.upsideWeight;
}
function isBetter(candidate:Candidate,currentBest:Candidate,key:StrategyKey){
  const candidateUtility=strategyUtility(candidate,key),bestUtility=strategyUtility(currentBest,key);
  if(candidateUtility>bestUtility+1e-9)return true;
  if(Math.abs(candidateUtility-bestUtility)>1e-9)return false;
  if(candidate.score>currentBest.score+1e-9)return true;
  if(Math.abs(candidate.score-currentBest.score)>1e-9)return false;
  const cr=proposalRisk(candidate.changes).score,br=proposalRisk(currentBest.changes).score;
  if(key!=="offensive"&&cr!==br)return cr<br;
  if(key==="offensive"&&modeledUpside(candidate.changes)!==modeledUpside(currentBest.changes))return modeledUpside(candidate.changes)>modeledUpside(currentBest.changes);
  return candidate.cost<currentBest.cost-1e-9;
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
  if(!team?.id)return NextResponse.json({ok:true,team:null,status:status?.[0]||null,changes:[],current:[],optimized:[],strategies:[],message:"Fant ingen lag for innlogget bruker."});

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
    const rawScore=Number(horizon==="next_game"?xr?.base_xfp_next_game??0:xr?.base_xfp_next3_rounds??0);
    const availabilityStatus=availabilityMap.get(c.id)||"available";
    const dataConfidence=confidence(xr?.data_confidence);
    const risk=playerRisk(availabilityStatus,dataConfidence);
    const adjustedScore=(Number.isFinite(rawScore)?rawScore:0)*availabilityXfpFactor(availabilityStatus);
    const player:Player={id:c.id,name:c.name,team:c.team,pos:position,price,raw_base_score:Number.isFinite(rawScore)?rawScore:0,base_score:adjustedScore,score:0,available:Boolean(c.active&&c.on_current_roster&&c.available_for_purchase!==false&&isOptimizerEligibleAvailability(availabilityStatus)),availability_status:availabilityStatus,data_confidence:dataConfidence,risk_score:risk.score,risk_label:risk.label,line_no:teamMeta?.line_no??null,is_captain:Boolean(teamMeta?.is_captain),is_vice_captain:Boolean(teamMeta?.is_vice_captain)};
    return withEffectiveScore(player);
  };

  const storedCurrent=teamRows.map(meta=>{const c=catalogMap.get(meta.player_id);return c?buildPlayer(c,meta):null}).filter(Boolean) as Player[];
  if(storedCurrent.length!==teamRows.length)return NextResponse.json({ok:false,error:`Kunne ikke speile hele fantasy-laget: ${storedCurrent.length}/${teamRows.length} spillere ble funnet i aktiv spillerkatalog.`},{status:500});
  if(storedCurrent.length!==12)return NextResponse.json({ok:true,team,status:status?.[0]||null,changes:[],current:storedCurrent,optimized:storedCurrent,strategies:[],message:`Det faktiske Fantasy-laget inneholder ${storedCurrent.length}/12 spillere. Laget må være komplett før bytter kan optimaliseres.`});

  const storedLineupValid=validLineup(storedCurrent);
  const current=storedLineupValid?storedCurrent.map(withEffectiveScore):optimizeLineup(storedCurrent);
  const all=((catalog||[]) as CatalogRow[]).map(c=>buildPlayer(c)).filter(Boolean) as Player[];
  const statusRow:any=status?.[0]||{};
  const remaining=Math.max(0,Math.min(2,Number(statusRow.transfers_remaining??2)));
  const budget=Number(economy?.[0]?.budget||100);
  const currentCost=current.reduce((s,p)=>s+p.price,0),currentScore=current.reduce((s,p)=>s+p.score,0);
  const baseline:Candidate={roster:current,score:currentScore,cost:currentCost,changes:[]};
  const bestByStrategy:Record<StrategyKey,Candidate>={balanced:baseline,conservative:baseline,offensive:baseline};
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
        const finalById=new Map(roster.map(p=>[p.id,p]));
        const candidate:Candidate={roster,score,cost,changes:pairs.map(({out,in:incoming})=>({out,in:finalById.get(incoming.id)!}))};
        for(const key of Object.keys(STRATEGIES) as StrategyKey[]){if(isBetter(candidate,bestByStrategy[key],key))bestByStrategy[key]=candidate}
      }
    }
  }

  const serialize=(p:Player)=>({...p,raw_base_score:round(p.raw_base_score),base_score:round(p.base_score),score:round(p.score),price:round(p.price,1),line_multiplier:lineMultiplier(p.line_no),role_multiplier:roleMultiplier(p)});
  const serializeCandidate=(key:StrategyKey,candidate:Candidate)=>{
    const risk=proposalRisk(candidate.changes),upside=modeledUpside(candidate.changes);
    return{
      key,label:STRATEGIES[key].label,description:STRATEGIES[key].description,
      optimized:candidate.roster.map(serialize),
      changes:candidate.changes.map(c=>({out:serialize(c.out),in:serialize(c.in),line_no:c.in.line_no,price_change:round(c.in.price-c.out.price,1),xfp_gain:round(c.in.score-c.out.score),risk_score:c.in.risk_score,risk_label:c.in.risk_label})),
      optimized_cost:round(candidate.cost,1),optimized_score:round(candidate.score),xfp_gain:round(candidate.score-currentScore),proposal_risk_score:risk.score,proposal_risk_label:risk.label,
      modeled_upside:round(upside),objective_score:round(strategyUtility(candidate,key)),
    };
  };
  const strategies=(Object.keys(STRATEGIES) as StrategyKey[]).map(key=>serializeCandidate(key,bestByStrategy[key]));
  const balanced=strategies.find(s=>s.key==="balanced")!;

  return NextResponse.json({
    ok:true,team,status:statusRow,economy:economy?.[0]||null,horizon,
    current:current.map(serialize),strategies,
    optimized:balanced.optimized,changes:balanced.changes,
    current_cost:round(currentCost,1),optimized_cost:balanced.optimized_cost,current_score:round(currentScore),optimized_score:balanced.optimized_score,xfp_gain:balanced.xfp_gain,transfers_available:remaining,
    proposal_risk_score:balanced.proposal_risk_score,proposal_risk_label:balanced.proposal_risk_label,
    strategy_policy:{
      balanced:"expected Fantasy-xFP - moderate incoming risk penalty + small modeled upside weight",
      conservative:"expected Fantasy-xFP - strong incoming risk penalty; rewards stable availability and confidence indirectly through lower risk",
      offensive:"expected Fantasy-xFP - light risk penalty + modeled upside from availability headroom and confidence uncertainty",
      invariant:"Fantasy scoring, availability factors, roster constraints, line multipliers and C/VC multipliers are identical for all strategies",
    },
    projection_policy:{player_xfp:"base xFP × availability factor",availability_factors:{available:1,returning:.85,questionable:.60,out:0,long_term:0,not_in_lineup:0},effective_fantasy_xfp:"availability-adjusted xFP × line multiplier × C/VC multiplier"},
    risk_policy:{availability:{available:0,returning:20,questionable:45,blocked:100},data_confidence:{high:0,medium:15,low:30},proposal:"65 % average incoming risk + 35 % highest incoming risk"},
    lineup_policy:{line1_multiplier:1,line2_multiplier:0.5,line_shape:"1G · 2D · 3F per rekke",stored_lineup_valid:storedLineupValid,analysis_lineup:storedLineupValid?"stored":"optimized_valid_fallback"},
    availability_policy:{authoritative_source:"fantasy_player_availability",blocked_statuses:["out","long_term","not_in_lineup"]},
    message:storedLineupValid?undefined:"Lagrede rekkedata var ugyldige. Analysen bruker derfor en gyldig 1G · 2D · 3F-fordeling per rekke og viser hvilke rekker som bør lagres.",
  });
}
