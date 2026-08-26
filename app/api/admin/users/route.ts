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
 const{data:player}=await authClient.from("players").select("admin,deactivated_at").eq("id",userData.user.id).maybeSingle();
 if(!player?.admin||player.deactivated_at)return{error:NextResponse.json({ok:false,error:"Kun aktiv administrator kan administrere brukere."},{status:403})};
 return{adminClient:createClient(supabaseUrl,secretKey,{auth:{persistSession:false,autoRefreshToken:false}}),currentUserId:userData.user.id};
}

async function writeAudit(adminClient:any,actorUserId:string,targetUserId:string,action:string,details:Record<string,unknown>){
 const{error}=await adminClient.from("user_admin_audit").insert({actor_user_id:actorUserId,target_user_id:targetUserId,action,details});
 return error;
}

export async function GET(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 const{adminClient}=context;
 const[{data:profiles,error:profileError},{data:authData,error:authError},{data:audit,error:auditError}]=await Promise.all([
  adminClient.from("players").select("id,display_name,email,admin,created_at,profile_name_confirmed_at,deactivated_at").order("created_at",{ascending:true}),
  adminClient.auth.admin.listUsers({page:1,perPage:1000}),
  adminClient.from("user_admin_audit").select("id,actor_user_id,target_user_id,action,details,created_at").order("created_at",{ascending:false}).limit(50)
 ]);
 if(profileError)return NextResponse.json({ok:false,error:"Kunne ikke hente profiler."},{status:500});
 if(authError)return NextResponse.json({ok:false,error:"Kunne ikke hente Auth-brukere."},{status:500});
 if(auditError)return NextResponse.json({ok:false,error:"Kunne ikke hente auditlogg."},{status:500});
 const authById=new Map((authData.users||[]).map(user=>[user.id,user]));
 const profileById=new Map((profiles||[]).map(profile=>[profile.id,profile]));
 const users=(profiles||[]).map(profile=>{const authUser=authById.get(profile.id);const bannedUntil=(authUser as {banned_until?:string|null}|undefined)?.banned_until??null;return{
  id:profile.id,display_name:profile.display_name||"",email:authUser?.email||profile.email||null,admin:Boolean(profile.admin),
  created_at:profile.created_at||authUser?.created_at||null,last_sign_in_at:authUser?.last_sign_in_at||null,email_confirmed_at:authUser?.email_confirmed_at||null,
  providers:Array.from(new Set((authUser?.identities||[]).map(identity=>identity.provider).filter(Boolean))),profile_complete:Boolean(profile.display_name?.trim()&&profile.profile_name_confirmed_at),
  is_current:profile.id===context.currentUserId,deactivated_at:profile.deactivated_at||null,banned_until:bannedUntil
 }});
 const auditRows=(audit||[]).map(row=>({
  ...row,
  actor_name:profileById.get(row.actor_user_id)?.display_name||"Ukjent administrator",
  target_name:profileById.get(row.target_user_id)?.display_name||"Ukjent bruker"
 }));
 return NextResponse.json({ok:true,users,audit:auditRows});
}

export async function PATCH(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 const body=await request.json().catch(()=>null),id=typeof body?.id==="string"?body.id:"",action=body?.action;
 if(!id)return NextResponse.json({ok:false,error:"Bruker-ID mangler."},{status:400});
 const{adminClient}=context;
 const{data:target,error:targetError}=await adminClient.from("players").select("id,display_name,admin,profile_name_confirmed_at,deactivated_at").eq("id",id).maybeSingle();
 if(targetError||!target)return NextResponse.json({ok:false,error:"Brukeren finnes ikke."},{status:404});

 if(action==="profile_name"){
  const displayName=normalizeName(body?.display_name);
  if(!validName(displayName))return NextResponse.json({ok:false,error:"Profilnavnet må være 2–60 tegn og kan ikke inneholde kontrolltegn."},{status:400});
  const previousName=target.display_name,previousConfirmedAt=target.profile_name_confirmed_at;
  const confirmedAt=new Date().toISOString();
  const{error}=await adminClient.from("players").update({display_name:displayName,profile_name_confirmed_at:confirmedAt}).eq("id",id);
  if(error)return NextResponse.json({ok:false,error:"Profilnavnet kunne ikke lagres."},{status:400});
  const auditError=await writeAudit(adminClient,context.currentUserId,id,"profile_name_changed",{from:previousName,to:displayName});
  if(auditError){await adminClient.from("players").update({display_name:previousName,profile_name_confirmed_at:previousConfirmedAt}).eq("id",id);return NextResponse.json({ok:false,error:"Endringen ble rullet tilbake fordi auditloggen ikke kunne skrives."},{status:500})}
  return NextResponse.json({ok:true,action,display_name:displayName});
 }

 if(action==="admin_role"){
  if(typeof body?.admin!=="boolean")return NextResponse.json({ok:false,error:"Ny administratorstatus mangler."},{status:400});
  const nextAdmin=body.admin;
  if(id===context.currentUserId&&!nextAdmin)return NextResponse.json({ok:false,error:"Du kan ikke fjerne din egen administratorstatus."},{status:400});
  if(target.admin&&!nextAdmin&&!target.deactivated_at){
   const{count,error:countError}=await adminClient.from("players").select("id",{count:"exact",head:true}).eq("admin",true).is("deactivated_at",null);
   if(countError)return NextResponse.json({ok:false,error:"Kunne ikke kontrollere administratorer."},{status:500});
   if((count??0)<=1)return NextResponse.json({ok:false,error:"Den siste aktive administratoren kan ikke fjernes."},{status:400});
  }
  const{error}=await adminClient.from("players").update({admin:nextAdmin}).eq("id",id);
  if(error)return NextResponse.json({ok:false,error:"Administratorrollen kunne ikke endres."},{status:400});
  const auditError=await writeAudit(adminClient,context.currentUserId,id,"admin_role_changed",{from:Boolean(target.admin),to:nextAdmin});
  if(auditError){await adminClient.from("players").update({admin:Boolean(target.admin)}).eq("id",id);return NextResponse.json({ok:false,error:"Endringen ble rullet tilbake fordi auditloggen ikke kunne skrives."},{status:500})}
  return NextResponse.json({ok:true,action,admin:nextAdmin});
 }

 if(action==="deactivate"){
  if(id===context.currentUserId)return NextResponse.json({ok:false,error:"Du kan ikke deaktivere din egen administratorkonto."},{status:400});
  if(target.deactivated_at)return NextResponse.json({ok:false,error:"Brukeren er allerede deaktivert."},{status:409});
  if(target.admin){
   const{count,error:countError}=await adminClient.from("players").select("id",{count:"exact",head:true}).eq("admin",true).is("deactivated_at",null);
   if(countError)return NextResponse.json({ok:false,error:"Kunne ikke kontrollere administratorer."},{status:500});
   if((count??0)<=1)return NextResponse.json({ok:false,error:"Den siste aktive administratoren kan ikke deaktiveres."},{status:400});
  }
  const{error:banError}=await adminClient.auth.admin.updateUserById(id,{ban_duration:"876000h"});
  if(banError)return NextResponse.json({ok:false,error:"Supabase Auth kunne ikke deaktivere brukeren."},{status:400});
  const deactivatedAt=new Date().toISOString();
  const{error:profileError}=await adminClient.from("players").update({deactivated_at:deactivatedAt}).eq("id",id);
  if(profileError){await adminClient.auth.admin.updateUserById(id,{ban_duration:"none"});return NextResponse.json({ok:false,error:"Deaktivering ble rullet tilbake fordi profilstatus ikke kunne lagres."},{status:500})}
  const auditError=await writeAudit(adminClient,context.currentUserId,id,"user_deactivated",{display_name:target.display_name});
  if(auditError){await adminClient.from("players").update({deactivated_at:null}).eq("id",id);await adminClient.auth.admin.updateUserById(id,{ban_duration:"none"});return NextResponse.json({ok:false,error:"Deaktivering ble rullet tilbake fordi auditloggen ikke kunne skrives."},{status:500})}
  return NextResponse.json({ok:true,action,deactivated_at:deactivatedAt});
 }

 if(action==="reactivate"){
  if(!target.deactivated_at)return NextResponse.json({ok:false,error:"Brukeren er allerede aktiv."},{status:409});
  const{error:unbanError}=await adminClient.auth.admin.updateUserById(id,{ban_duration:"none"});
  if(unbanError)return NextResponse.json({ok:false,error:"Supabase Auth kunne ikke gjenåpne brukeren."},{status:400});
  const{error:profileError}=await adminClient.from("players").update({deactivated_at:null}).eq("id",id);
  if(profileError){await adminClient.auth.admin.updateUserById(id,{ban_duration:"876000h"});return NextResponse.json({ok:false,error:"Gjenåpning ble rullet tilbake fordi profilstatus ikke kunne lagres."},{status:500})}
  const auditError=await writeAudit(adminClient,context.currentUserId,id,"user_reactivated",{previous_deactivated_at:target.deactivated_at});
  if(auditError){await adminClient.from("players").update({deactivated_at:target.deactivated_at}).eq("id",id);await adminClient.auth.admin.updateUserById(id,{ban_duration:"876000h"});return NextResponse.json({ok:false,error:"Gjenåpning ble rullet tilbake fordi auditloggen ikke kunne skrives."},{status:500})}
  return NextResponse.json({ok:true,action});
 }

 return NextResponse.json({ok:false,error:"Ugyldig brukerhandling."},{status:400});
}

export async function DELETE(request:NextRequest){
 const context=await getAdmin(request);if("error" in context)return context.error;
 return NextResponse.json({ok:false,error:"Permanent sletting er deaktivert. Brukerdata og konkurransehistorikk skal ikke slettes fra denne flaten."},{status:405});
}
