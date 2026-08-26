import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeName(value:unknown){return typeof value==="string"?value.trim().replace(/\s+/g," "):""}
function validName(value:string){return value.length>=2&&value.length<=60&&!/[\u0000-\u001f\u007f]/.test(value)}

async function getAdmin(request:NextRequest){
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secretKey=process.env.SUPABASE_SECRET_KEY;
 if(!supabaseUrl||!publishableKey||!secretKey)return{error:NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503})};
 const authHeader=request.headers.get("authorization"),token=authHeader?.startsWith("Bearer ")?authHeader.slice(7):null;
 if(!token)return{error:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
 const authClient=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const{data:userData,error:userError}=await authClient.auth.getUser(token);
 if(userError||!userData.user)return{error:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
 const{data:player}=await authClient.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
 if(!player?.admin)return{error:NextResponse.json({ok:false,error:"Kun administrator kan administrere brukere."},{status:403})};
 return{adminClient:createClient(supabaseUrl,secretKey,{auth:{persistSession:false,autoRefreshToken:false}}),currentUserId:userData.user.id};
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
 const users=(profiles||[]).map(profile=>{const authUser=authById.get(profile.id);return{
  id:profile.id,display_name:profile.display_name||"",email:authUser?.email||profile.email||null,admin:Boolean(profile.admin),
  created_at:profile.created_at||authUser?.created_at||null,last_sign_in_at:authUser?.last_sign_in_at||null,email_confirmed_at:authUser?.email_confirmed_at||null,
  providers:Array.from(new Set((authUser?.identities||[]).map(identity=>identity.provider).filter(Boolean))),profile_complete:Boolean(profile.display_name?.trim()&&profile.profile_name_confirmed_at),is_current:profile.id===context.currentUserId
 }});
 return NextResponse.json({ok:true,users});
}

export async function PATCH(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 const body=await request.json().catch(()=>null),id=typeof body?.id==="string"?body.id:"",action=body?.action;
 if(!id)return NextResponse.json({ok:false,error:"Bruker-ID mangler."},{status:400});
 const{adminClient}=context;
 const{data:target,error:targetError}=await adminClient.from("players").select("id,display_name,admin").eq("id",id).maybeSingle();
 if(targetError||!target)return NextResponse.json({ok:false,error:"Brukeren finnes ikke."},{status:404});
 if(action==="profile_name"){
  const displayName=normalizeName(body?.display_name);
  if(!validName(displayName))return NextResponse.json({ok:false,error:"Profilnavnet må være 2–60 tegn og kan ikke inneholde kontrolltegn."},{status:400});
  const{error}=await adminClient.from("players").update({display_name:displayName,profile_name_confirmed_at:new Date().toISOString()}).eq("id",id);
  if(error)return NextResponse.json({ok:false,error:"Profilnavnet kunne ikke lagres."},{status:400});
  return NextResponse.json({ok:true,action,display_name:displayName});
 }
 if(action==="admin_role"){
  if(typeof body?.admin!=="boolean")return NextResponse.json({ok:false,error:"Ny administratorstatus mangler."},{status:400});
  const nextAdmin=body.admin;
  if(id===context.currentUserId&&!nextAdmin)return NextResponse.json({ok:false,error:"Du kan ikke fjerne din egen administratorstatus."},{status:400});
  if(target.admin&&!nextAdmin){
   const{count,error:countError}=await adminClient.from("players").select("id",{count:"exact",head:true}).eq("admin",true);
   if(countError)return NextResponse.json({ok:false,error:"Kunne ikke kontrollere administratorer."},{status:500});
   if((count??0)<=1)return NextResponse.json({ok:false,error:"Den siste administratoren kan ikke fjernes."},{status:400});
  }
  const{error}=await adminClient.from("players").update({admin:nextAdmin}).eq("id",id);
  if(error)return NextResponse.json({ok:false,error:"Administratorrollen kunne ikke endres."},{status:400});
  return NextResponse.json({ok:true,action,admin:nextAdmin});
 }
 return NextResponse.json({ok:false,error:"Ugyldig brukerhandling."},{status:400});
}

export async function DELETE(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 return NextResponse.json({ok:false,error:"Permanent sletting er deaktivert. Brukerdata og konkurransehistorikk skal ikke slettes fra denne flaten."},{status:405});
}
