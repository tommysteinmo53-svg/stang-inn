import {NextRequest,NextResponse} from "next/server";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {importAllPreseasonHockeyLive,importPreseasonHockeyLiveMatch} from "../../../../../lib/fantasy/preseason-import-service";
import {reconcileHockeyLivePreseasonScores} from "../../../../../lib/fantasy/preseason-score-reconcile";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 try{
  const body=await request.json().catch(()=>({}));
  if(body?.all===true){const result=await importAllPreseasonHockeyLive();const scoreReconcile=await reconcileHockeyLivePreseasonScores();return NextResponse.json({ok:true,...result,scoreReconcile});}
  const id=Number(body?.preseasonGameId);if(!Number.isInteger(id)||id<=0)return NextResponse.json({ok:false,error:"preseasonGameId må være et positivt heltall"},{status:400});
  const result=await importPreseasonHockeyLiveMatch(id);const scoreReconcile=await reconcileHockeyLivePreseasonScores();return NextResponse.json({ok:true,...result,scoreReconcile});
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Ukjent preseason-importfeil"},{status:500});}
}
