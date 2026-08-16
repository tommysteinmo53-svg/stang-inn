import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {ELITEPROSPECTS_ROSTER_2026,ELITEPROSPECTS_ROSTER_COUNTS_2026,ELITEPROSPECTS_ROSTER_2026_VERIFIED_AT} from "../../../../../lib/fantasy/eliteprospects-roster-2026";
import {canonicalFantasyTeam,EHL_TEAMS_2026_27,isCurrentEhlTeam2026} from "../../../../../lib/fantasy/team-normalization";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serverClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error("Supabase server-variabler mangler");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function norm(v:any){return String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim()}
function lastNameKey(v:any){const p=norm(v).split(" ").filter(Boolean);return p[p.length-1]||""}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  try{
    const sb=serverClient();
    const{data,error}=await sb.from("fantasy_players").select("id,name,team,position,external_id,active,on_current_roster,available_for_purchase");
    if(error)throw error;
    const all=data||[];
    const current=all.filter((p:any)=>p.active===true&&p.on_current_roster===true);

    const byName=new Map<string,any[]>();
    for(const p of current){const k=norm(p.name),arr=byName.get(k)||[];arr.push(p);byName.set(k,arr)}
    const used=new Set<string>();
    const matched:any[]=[],teamMismatch:any[]=[],missing:any[]=[],ambiguous:any[]=[];

    for(const ep of ELITEPROSPECTS_ROSTER_2026){
      const candidates=byName.get(norm(ep.name))||[];
      if(candidates.length===1){
        const p=candidates[0];
        const dbTeam=canonicalFantasyTeam(p.team);
        const row={epName:ep.name,epTeam:ep.team,epRole:ep.role,playerId:p.id,dbName:p.name,dbTeam,rawDbTeam:p.team,position:p.position,externalId:p.external_id};
        if(dbTeam===ep.team){matched.push(row);used.add(String(p.id))}else teamMismatch.push(row);
      }else if(candidates.length>1){
        ambiguous.push({epName:ep.name,epTeam:ep.team,reason:"duplicate_normalized_name",candidates:candidates.map((p:any)=>({id:p.id,name:p.name,team:p.team,externalId:p.external_id}))});
      }else{
        const manualCandidates=current.filter((p:any)=>canonicalFantasyTeam(p.team)===ep.team&&lastNameKey(p.name)===lastNameKey(ep.name)).map((p:any)=>({id:p.id,name:p.name,team:p.team,position:p.position,externalId:p.external_id}));
        missing.push({epName:ep.name,epTeam:ep.team,epRole:ep.role,manualCandidates});
      }
    }

    const extras=current.filter((p:any)=>!used.has(String(p.id))&&!teamMismatch.some((m:any)=>String(m.playerId)===String(p.id))).map((p:any)=>({id:p.id,name:p.name,team:canonicalFantasyTeam(p.team),rawTeam:p.team,position:p.position,externalId:p.external_id,isCurrentEhlTeam:isCurrentEhlTeam2026(p.team)}));
    const rawTeamVariants=Object.entries(current.reduce<Record<string,Record<string,number>>>((acc:any,p:any)=>{const c=canonicalFantasyTeam(p.team);acc[c]??={};acc[c][String(p.team)]=(acc[c][String(p.team)]||0)+1;return acc;},{})).map(([team,variants])=>({team,variants})).filter((x:any)=>Object.keys(x.variants).length>1);

    const perTeam=EHL_TEAMS_2026_27.map(team=>({
      team,
      expected:ELITEPROSPECTS_ROSTER_COUNTS_2026[team]||0,
      current:current.filter((p:any)=>canonicalFantasyTeam(p.team)===team).length,
      matched:matched.filter((p:any)=>p.epTeam===team).length,
      teamMismatch:teamMismatch.filter((p:any)=>p.epTeam===team||p.dbTeam===team).length,
      missing:missing.filter((p:any)=>p.epTeam===team).length,
      extras:extras.filter((p:any)=>p.team===team).length,
    }));

    const targetNames=new Set(["matteo mitrovic","johan torres selnes","mathias dehli"]);
    const targets={
      eliteProspects:ELITEPROSPECTS_ROSTER_2026.filter(x=>targetNames.has(norm(x.name))).map(x=>({name:x.name,team:x.team,role:x.role})),
      production:all.filter((p:any)=>targetNames.has(norm(p.name))).map((p:any)=>({id:p.id,name:p.name,team:p.team,canonicalTeam:canonicalFantasyTeam(p.team),position:p.position,externalId:p.external_id,active:p.active,onCurrentRoster:p.on_current_roster})),
    };

    return NextResponse.json({
      ok:true,
      season:"2026/27",
      authority:"EliteProspects",
      verifiedAt:ELITEPROSPECTS_ROSTER_2026_VERIFIED_AT,
      safety:{autoFuzzyMatch:false,manualCandidatesAreNonAuthoritative:true},
      summary:{expected:ELITEPROSPECTS_ROSTER_2026.length,current:current.length,matched:matched.length,teamMismatch:teamMismatch.length,missing:missing.length,ambiguous:ambiguous.length,extras:extras.length},
      perTeam,
      rawTeamVariants,
      targets,
      details:{teamMismatch,missing,ambiguous,extras,matched},
    });
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"EliteProspects roster-audit feilet"},{status:500})}
}
