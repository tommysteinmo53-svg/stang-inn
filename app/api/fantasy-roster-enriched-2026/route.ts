import {NextRequest,NextResponse} from "next/server";
import {enrichMissingPositions} from "../../../lib/fantasy/eliteprospects-position-enrichment";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
  try{
    const base=`${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const r=await fetch(`${base}/api/fantasy-roster-2026`,{cache:"no-store",headers:{Accept:"application/json"}});
    const j=await r.json();
    if(!r.ok||!j.ok)return NextResponse.json(j,{status:r.status});
    const sourceRows=Array.isArray(j.rows)?j.rows:[];
    const beforeMissing=sourceRows.filter((x:any)=>!x.position).length;
    const enriched=await enrichMissingPositions(sourceRows);
    return NextResponse.json({
      ...j,
      rows:enriched.rows,
      positionEnrichment:{
        source:"EliteProspects 2026/27 team rosters",
        beforeMissing,
        enriched:enriched.enriched,
        remaining:enriched.remaining,
        diagnostics:enriched.diagnostics,
      },
    });
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Posisjonsberikelse feilet"},{status:500})}
}
