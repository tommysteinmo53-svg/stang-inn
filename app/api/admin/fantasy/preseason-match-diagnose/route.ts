import {NextRequest,NextResponse} from "next/server";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {diagnoseExternalPreseasonMatches} from "../../../../../lib/fantasy/preseason-external-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  try{
    const result=await diagnoseExternalPreseasonMatches();
    return NextResponse.json({ok:true,...result});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Kunne ikke kjøre preseason match-diagnose"},{status:500});
  }
}
