import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdmin(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !publishableKey || !secretKey) return { error: NextResponse.json({ ok:false,error:"Supabase-konfigurasjon mangler." },{status:503}) };
  const authHeader=request.headers.get("authorization");
  const token=authHeader?.startsWith("Bearer ")?authHeader.slice(7):null;
  if(!token)return{error:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
  const authClient=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const{data:userData,error:userError}=await authClient.auth.getUser(token);
  if(userError||!userData.user)return{error:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const{data:player}=await authClient.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
  if(!player?.admin)return{error:NextResponse.json({ok:false,error:"Kun administrator kan administrere brukere."},{status:403})};
  const adminClient=createClient(supabaseUrl,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return{adminClient,currentUserId:userData.user.id};
}

export async function GET(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 const{adminClient}=context;
 const[{data:profiles,error:profileError},{data:authData,error:authError}]=await Promise.all([
  adminClient.from("players").select("id,display_name,email,admin,created_at,profile_name_confirmed_at").order("created_at",{ascending:true}),
  adminClient.auth.admin.listUsers({page:1,perPage:1000})
 ]);
 if(profileError)return NextResponse.json({ok:false,error:"Kunne ikke hente profiler."},{status:500});
 if(authError)return NextResponse.json({ok:false,error:"Kunne ikke hente Auth-brukere."},{status:500});
 const authById=new Map((authData.users||[]).map(user=>[user.id,user]));
 const users=(profiles||[]).map(profile=>{
  const authUser=authById.get(profile.id);
  const providers=Array.from(new Set((authUser?.identities||[]).map(identity=>identity.provider).filter(Boolean)));
  return{
   id:profile.id,
   display_name:profile.display_name||"",
   email:authUser?.email||profile.email||null,
   admin:Boolean(profile.admin),
   created_at:profile.created_at||authUser?.created_at||null,
   last_sign_in_at:authUser?.last_sign_in_at||null,
   email_confirmed_at:authUser?.email_confirmed_at||null,
   providers,
   profile_complete:Boolean(profile.display_name?.trim()&&profile.profile_name_confirmed_at),
  };
 });
 return NextResponse.json({ok:true,users});
}

export async function PATCH(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 const body=await request.json().catch(()=>null);const id=typeof body?.id==="string"?body.id:"";const displayName=typeof body?.display_name==="string"?body.display_name.trim():"";const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";const admin=Boolean(body?.admin);
 if(!id||!displayName||!email)return NextResponse.json({ok:false,error:"Navn og e-post må fylles ut."},{status:400});
 if(id===context.currentUserId&&!admin)return NextResponse.json({ok:false,error:"Du kan ikke fjerne din egen administratorstatus."},{status:400});
 const{adminClient}=context;
 const{error:authError}=await adminClient.auth.admin.updateUserById(id,{email,user_metadata:{display_name:displayName}});if(authError)return NextResponse.json({ok:false,error:authError.message},{status:400});
 const{error:playerError}=await adminClient.from("players").update({display_name:displayName,email,admin}).eq("id",id);if(playerError)return NextResponse.json({ok:false,error:playerError.message},{status:400});
 return NextResponse.json({ok:true});
}

export async function DELETE(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 const body=await request.json().catch(()=>null);const id=typeof body?.id==="string"?body.id:"";if(!id)return NextResponse.json({ok:false,error:"Bruker-ID mangler."},{status:400});if(id===context.currentUserId)return NextResponse.json({ok:false,error:"Du kan ikke slette din egen administratorkonto."},{status:400});
 const{error}=await context.adminClient.auth.admin.deleteUser(id);if(error)return NextResponse.json({ok:false,error:error.message},{status:400});return NextResponse.json({ok:true});
}
