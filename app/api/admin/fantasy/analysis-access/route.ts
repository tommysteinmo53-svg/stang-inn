import {NextRequest,NextResponse} from "next/server";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;

  return NextResponse.json({
    ok:true,
    userId:admin.userId,
    modules:[
      {key:"recommendations",label:"Anbefalingsmotor",adminOnly:true},
      {key:"expected-points",label:"Forventede fantasy-poeng",adminOnly:true},
      {key:"preseason",label:"Preseason-form",adminOnly:true},
      {key:"availability",label:"Skader & tilgjengelighet",adminOnly:true},
      {key:"optimizer",label:"Optimal lag-generator",adminOnly:true},
      {key:"transfer-assistant",label:"Bytteassistent",adminOnly:true},
    ],
  });
}
