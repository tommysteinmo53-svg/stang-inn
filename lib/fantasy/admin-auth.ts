import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export type FantasyAdminResult=
  | {ok:true;userId:string}
  | {ok:false;response:NextResponse};

/**
 * Server-side authorization boundary for Stang Inn's private Fantasy analysis tools.
 * Never rely on hidden UI alone: every admin analysis API must call this guard.
 */
export async function requireFantasyAdmin(request:NextRequest):Promise<FantasyAdminResult>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key){
    return{ok:false,response:NextResponse.json({ok:false,error:"Supabase public-konfigurasjon mangler."},{status:503})};
  }

  const header=request.headers.get("authorization");
  const token=header?.startsWith("Bearer ")?header.slice(7):null;
  if(!token){
    return{ok:false,response:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
  }

  const auth=createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:`Bearer ${token}`}},
  });

  const{data:userData,error:userError}=await auth.auth.getUser(token);
  if(userError||!userData.user){
    return{ok:false,response:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  }

  const{data:player,error:playerError}=await auth
    .from("players")
    .select("admin")
    .eq("id",userData.user.id)
    .maybeSingle();

  if(playerError||!player?.admin){
    return{ok:false,response:NextResponse.json({ok:false,error:"Denne Fantasy-analysen er kun tilgjengelig for admin."},{status:403})};
  }

  return{ok:true,userId:userData.user.id};
}
