import {NextRequest,NextResponse} from "next/server";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {getExternalPreseasonRegistrySummary,importExternalPreseasonRegistry} from "../../../../../lib/fantasy/preseason-external-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  return NextResponse.json({ok:true,...getExternalPreseasonRegistrySummary()});
}

export async function POST(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  try{
    const result=await importExternalPreseasonRegistry();
    return NextResponse.json({ok:true,...result,importedAt:new Date().toISOString()});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Kunne ikke importere eksterne preseason-data"},{status:500});
  }
}
