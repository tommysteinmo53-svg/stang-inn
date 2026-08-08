import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scoreFinishedMatches } from "../../../../lib/score-engine";

export const runtime="nodejs";
export const dynamic="force-dynamic";

async function getAdmin(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key||!secret)return{error:NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503})};
 const header=request.headers.get("authorization"),token=header?.startsWith("Bearer ")?header.slice(7):null;
 if(!token)return{error:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const{data:userData,error:userError}=await auth.auth.getUser(token);if(userError||!userData.user)return{error:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
 const{data:player}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();if(!player?.admin)return{error:NextResponse.json({ok:false,error:"Kun administrator kan korrigere kamper."},{status:403})};
 return{admin:createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})};
}

export async function PATCH(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 const body=await request.json().catch(()=>null);const id=Number(body?.id);if(!Number.isInteger(id)||id<=0)return NextResponse.json({ok:false,error:"Ugyldig kamp-ID."},{status:400});
 const finished=Boolean(body?.finished);const home=body?.home_score===null||body?.home_score===""?null:Number(body?.home_score);const away=body?.away_score===null||body?.away_score===""?null:Number(body?.away_score);const matchTime=typeof body?.match_time==="string"&&body.match_time?new Date(body.match_time).toISOString():null;
 if((home!==null&&(!Number.isInteger(home)||home<0))||(away!==null&&(!Number.isInteger(away)||away<0)))return NextResponse.json({ok:false,error:"Score må være hele tall fra 0 og oppover."},{status:400});
 if(finished&&(home===null||away===null))return NextResponse.json({ok:false,error:"En ferdig kamp må ha både hjemme- og bortescore."},{status:400});
 const update:Record<string,unknown>={finished,home_score:home,away_score:away};if(matchTime)update.match_time=matchTime;
 const{data:match,error}=await context.admin.from("matches").update(update).eq("id",id).select("id,home_team,away_team,match_time,home_score,away_score,finished").maybeSingle();if(error)return NextResponse.json({ok:false,error:error.message},{status:400});if(!match)return NextResponse.json({ok:false,error:"Kampen ble ikke funnet."},{status:404});
 if(!finished){const{error:clearError}=await context.admin.from("tips").update({points:null}).eq("match_id",id);if(clearError)return NextResponse.json({ok:false,error:clearError.message},{status:400});}
 const scoring=await scoreFinishedMatches(context.admin);
 return NextResponse.json({ok:true,match,scoring});
}
