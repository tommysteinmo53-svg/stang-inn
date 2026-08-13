import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const CONFIRM="SYNK 2026/27 ROSTER";
const KEEP="e9647e74-9745-450d-a27a-3cc5852026ed";
const DROP="99c086a2-3742-4478-9a6c-ad7425c50605";

async function requireAdmin(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  const h=request.headers.get("authorization"),token=h?.startsWith("Bearer ")?h.slice(7):null;
  if(!token)return null;
  const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const{data:u}=await c.auth.getUser(token);if(!u.user)return null;
  const{data:p}=await c.from("players").select("admin").eq("id",u.user.id).maybeSingle();
  return p?.admin?u.user.id:null;
}
function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function POST(request:NextRequest){
  try{
    const admin=await requireAdmin(request);if(!admin)return NextResponse.json({ok:false,error:"Kun admin kan synkronisere roster."},{status:403});
    const body=await request.json();
    if(body?.confirmation!==CONFIRM)return NextResponse.json({ok:false,error:`Skriv nøyaktig «${CONFIRM}».`},{status:400});
    const rows=Array.isArray(body?.rows)?body.rows:[];
    if(rows.length<200||rows.length>300)return NextResponse.json({ok:false,error:`Uventet rosterstørrelse: ${rows.length}`},{status:400});
    const seen=new Set<string>();
    for(const r of rows){const name=String(r?.name||"").trim(),team=String(r?.team||"").trim(),position=String(r?.position||"").toUpperCase();if(!name||!team||!["C","W","D","G"].includes(position))return NextResponse.json({ok:false,error:`Ugyldig roster-rad: ${name||"(uten navn)"}`},{status:400});const k=name.toLocaleLowerCase("nb-NO");if(seen.has(k))return NextResponse.json({ok:false,error:`Duplisert navn i roster-payload: ${name}`},{status:400});seen.add(k)}
    const sb=serverClient();
    const payload=rows.map((r:any)=>({name:String(r.name),team:String(r.team),position:String(r.position),personId:r.personId==null?null:String(r.personId)}));
    const{data,error}=await sb.rpc("sync_fantasy_roster_2026",{p_rows:payload,p_admin:admin,p_duplicate_keep:KEEP,p_duplicate_drop:DROP});
    if(error){const missing=String(error.message||"").includes("sync_fantasy_roster_2026");return NextResponse.json({ok:false,error:missing?"Supabase v0.9 roster-sync migrasjonen må kjøres først.":error.message},{status:missing?503:500})}
    return NextResponse.json({ok:true,result:data});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Roster-sync feilet"},{status:500})}
}
