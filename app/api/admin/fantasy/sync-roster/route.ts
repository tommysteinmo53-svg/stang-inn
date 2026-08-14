import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const CONFIRM="SYNK 2026/27 ROSTER";
const KEEP="e9647e74-9745-450d-a27a-3cc5852026ed";
const DROP="99c086a2-3742-4478-9a6c-ad7425c50605";
const VALID=new Set(["C","W","D","G"]);
const MIN_ROSTER=150,MAX_ROSTER=350;

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
    if(rows.length<MIN_ROSTER||rows.length>MAX_ROSTER)return NextResponse.json({ok:false,error:`Uventet rosterstørrelse: ${rows.length}. Forventet ${MIN_ROSTER}–${MAX_ROSTER}.`},{status:400});

    const seen=new Set<string>(),duplicates:string[]=[];
    for(const r of rows){const name=String(r?.name||"").trim(),k=name.toLocaleLowerCase("nb-NO");if(seen.has(k))duplicates.push(name);else seen.add(k)}
    if(duplicates.length)return NextResponse.json({ok:false,error:`Dupliserte navn i roster-payload: ${duplicates.join(", ")}`,duplicates},{status:400});

    const sb=serverClient();
    const{data:existing,error:existingError}=await sb.from("fantasy_players").select("name,position,active,external_id");
    if(existingError)throw existingError;

    const dbPositionsByName=new Map<string,Set<string>>();
    const dbPositionsByExternal=new Map<string,Set<string>>();
    for(const p of existing||[]){
      const pos=String((p as any).position||"").trim().toUpperCase();
      if(!VALID.has(pos))continue;
      const name=String((p as any).name||"").trim().toLocaleLowerCase("nb-NO");
      if((p as any).active!==false&&name){const set=dbPositionsByName.get(name)||new Set<string>();set.add(pos);dbPositionsByName.set(name,set)}
      const external=String((p as any).external_id||"").trim();
      if(external){const set=dbPositionsByExternal.get(external)||new Set<string>();set.add(pos);dbPositionsByExternal.set(external,set)}
    }

    let reusedDatabasePositions=0,reusedByExternalId=0,reusedByName=0;
    const resolved=rows.map((r:any)=>{
      const name=String(r?.name||"").trim();
      const team=String(r?.team||"").trim();
      const external=r?.personId==null?"":`nif:${String(r.personId).trim()}`;
      let position=String(r?.position||"").trim().toUpperCase();
      let positionSource=String(r?.positionSource||"");
      if(!VALID.has(position)&&external){
        const options=dbPositionsByExternal.get(external);
        if(options&&options.size===1){position=[...options][0];positionSource="fantasy_players-external_id";reusedDatabasePositions++;reusedByExternalId++}
      }
      if(!VALID.has(position)&&name){
        const options=dbPositionsByName.get(name.toLocaleLowerCase("nb-NO"));
        if(options&&options.size===1){position=[...options][0];positionSource="fantasy_players-name";reusedDatabasePositions++;reusedByName++}
      }
      return {...r,name,team,position,positionSource};
    });

    const invalid=resolved.filter((r:any)=>!r.name||!r.team||!VALID.has(r.position)).map((r:any)=>({name:r.name,team:r.team,position:r.position||"",personId:r.personId??null}));
    if(invalid.length){
      const detail=invalid.map((r:any)=>`${r.name||"(uten navn)"} [${r.position||"mangler posisjon"}]`).join(", ");
      return NextResponse.json({ok:false,error:`${invalid.length} roster-rader mangler fortsatt sikker posisjon etter ID/navn-fallback: ${detail}`,invalidRows:invalid,reusedDatabasePositions,reusedByExternalId,reusedByName},{status:400});
    }

    const payload=resolved.map((r:any)=>({name:r.name,team:r.team,position:r.position,positionSource:r.positionSource||null,personId:r.personId==null?null:String(r.personId)}));
    const{data,error}=await sb.rpc("sync_fantasy_roster_2026",{p_rows:payload,p_admin:admin,p_duplicate_keep:KEEP,p_duplicate_drop:DROP});
    if(error){const missing=String(error.message||"").includes("sync_fantasy_roster_2026");return NextResponse.json({ok:false,error:missing?"Supabase v0.32 roster-livssyklusmigrasjonen må kjøres først.":error.message},{status:missing?503:500})}
    return NextResponse.json({ok:true,result:data,reusedDatabasePositions,reusedByExternalId,reusedByName});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Roster-sync feilet"},{status:500})}
}
