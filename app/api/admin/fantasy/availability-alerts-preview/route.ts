import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function serviceClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

const statusLabel=(status:string)=>({
  questionable:"Usikker",
  returning:"Tilbake",
  out:"Ute",
  long_term:"Langtid ute",
  not_in_lineup:"Ikke i kamptropp",
}[status]||status);

function messageFor(playerName:string,status:string,note?:string|null){
  const label=statusLabel(status);
  const suffix=note?` ${note}`:"";
  return `${playerName}: ${label}.${suffix}`.trim();
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);
  if(!admin.ok)return admin.response;
  const sb=serviceClient();
  if(!sb)return NextResponse.json({ok:false,error:"Supabase server-konfigurasjon mangler."},{status:503});

  const[
    {data:availability,error:availabilityError},
    {data:teams,error:teamsError},
    {data:teamPlayers,error:teamPlayersError},
    {data:players,error:playersError},
  ]=await Promise.all([
    sb.from("fantasy_player_availability").select("player_id,status,note,expected_return,updated_at").neq("status","available"),
    sb.from("fantasy_user_teams").select("id,user_id,name,season").eq("season","2026/27"),
    sb.from("fantasy_user_team_players").select("team_id,player_id"),
    sb.from("fantasy_players").select("id,name,team,position,active,on_current_roster"),
  ]);

  const error=availabilityError||teamsError||teamPlayersError||playersError;
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

  const teamMap=new Map((teams||[]).map((row:any)=>[row.id,row]));
  const playerMap=new Map((players||[]).map((row:any)=>[row.id,row]));
  const ownershipByPlayer=new Map<string,any[]>();
  for(const row of teamPlayers||[]){
    const team:any=teamMap.get((row as any).team_id);
    if(!team)continue;
    const list=ownershipByPlayer.get((row as any).player_id)||[];
    list.push(team);
    ownershipByPlayer.set((row as any).player_id,list);
  }

  const rows=(availability||[]).map((a:any)=>{
    const player:any=playerMap.get(a.player_id)||null;
    const status=normalizeFantasyAvailabilityStatus(a.status);
    const ownedBy=ownershipByPlayer.get(a.player_id)||[];
    const uniqueUsers=new Set(ownedBy.map((team:any)=>team.user_id));
    return {
      player_id:a.player_id,
      player_name:player?.name||"Ukjent spiller",
      team:player?.team||"—",
      player_position:player?.position||"—",
      status,
      status_label:statusLabel(status),
      note:a.note||null,
      expected_return:a.expected_return||null,
      availability_updated_at:a.updated_at||null,
      active:player?.active??null,
      on_current_roster:player?.on_current_roster??null,
      affected_teams:ownedBy.length,
      affected_users:uniqueUsers.size,
      affected_team_names:ownedBy.map((team:any)=>team.name).sort((x:string,y:string)=>x.localeCompare(y,"nb")),
      notification_preview:{
        type:status==="returning"?"info":"warning",
        title:`Spillerstatus: ${player?.name||"spiller"}`,
        message:messageFor(player?.name||"Spiller",status,a.note),
        link:"/fantasy/team",
      },
    };
  }).filter((row:any)=>row.affected_users>0)
    .sort((a:any,b:any)=>b.affected_users-a.affected_users||a.player_name.localeCompare(b.player_name,"nb"));

  return NextResponse.json({
    ok:true,
    rows,
    summary:{
      affected_players:rows.length,
      recipient_links:rows.reduce((sum:number,row:any)=>sum+row.affected_users,0),
      mode:"preview_only",
      writes:0,
      authoritative_source:"fantasy_player_availability",
    },
  });
}
