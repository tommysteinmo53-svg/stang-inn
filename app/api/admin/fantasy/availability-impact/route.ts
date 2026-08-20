import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityAdjustmentLabel,availabilityXfpFactor,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function clientFor(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=clientFor(request);
  if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});

  const{data:availability,error:availabilityError}=await sb
    .from("fantasy_player_availability")
    .select("player_id,status,note,expected_return,updated_at")
    .neq("status","available");
  if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});

  if(!availability?.length)return NextResponse.json({ok:true,rows:[]});

  const ids=availability.map((row:any)=>row.player_id);
  const{data:players,error:playersError}=await sb
    .from("fantasy_players")
    .select("id,name,team,position,active,on_current_roster")
    .in("id",ids);
  if(playersError)return NextResponse.json({ok:false,error:playersError.message},{status:500});

  const playerMap=new Map((players||[]).map((row:any)=>[row.id,row]));
  const rows=availability.map((row:any)=>{
    const player:any=playerMap.get(row.player_id)||null;
    const status=normalizeFantasyAvailabilityStatus(row.status);
    const factor=availabilityXfpFactor(status);
    return {
      player_id:row.player_id,
      player_name:player?.name||"Ukjent spiller",
      team:player?.team||"—",
      player_position:player?.position||"—",
      active:player?.active??null,
      on_current_roster:player?.on_current_roster??null,
      availability_status:status,
      availability_factor:factor,
      availability_adjustment:availabilityAdjustmentLabel(status),
      availability_note:row.note||null,
      availability_expected_return:row.expected_return||null,
      availability_updated_at:row.updated_at||null,
      blocked:factor===0,
    };
  }).sort((a:any,b:any)=>a.availability_factor-b.availability_factor||a.player_name.localeCompare(b.player_name,"nb"));

  return NextResponse.json({ok:true,rows});
}
