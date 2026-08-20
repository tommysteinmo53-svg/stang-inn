import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {matchAvailabilityFinding} from "../../../../../lib/fantasy/availability-match";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const sourceKinds=new Set(["club","nitten","hockeylive","local_media","facebook","instagram","other"]);
const statuses=new Set(["available","questionable","out","long_term","returning","not_in_lineup"]);
const reviewStates=new Set(["pending","needs_review","rejected","approved"]);
const notifiableStatuses=new Set(["questionable","out","long_term","returning","not_in_lineup"]);

function sb(){
  const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY;
  if(!u||!k)throw new Error("Supabase server-variabler mangler");
  return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}});
}

function statusLabel(status:string){
  return ({questionable:"usikker",out:"ute",long_term:"langtid ute",returning:"tilbake",not_in_lineup:"ikke i kamptropp"} as Record<string,string>)[status]||status;
}

async function notifyFantasyOwners(c:ReturnType<typeof sb>,playerId:string,status:string,reviewerId:string){
  if(!notifiableStatuses.has(status))return {eligible:false,recipients:0,delivered:0,already_delivered:0,failed:0};

  const[{data:availability,error:aErr},{data:player,error:pErr},{data:teamPlayerRows,error:tpErr}]=await Promise.all([
    c.from("fantasy_player_availability").select("player_id,status,note,updated_at").eq("player_id",playerId).maybeSingle(),
    c.from("fantasy_players").select("id,name").eq("id",playerId).maybeSingle(),
    c.from("fantasy_user_team_players").select("team_id").eq("player_id",playerId),
  ]);
  if(aErr)throw aErr;if(pErr)throw pErr;if(tpErr)throw tpErr;
  if(!availability||availability.status!==status||!availability.updated_at)return {eligible:false,recipients:0,delivered:0,already_delivered:0,failed:0};

  const teamIds=[...new Set((teamPlayerRows||[]).map((r:any)=>r.team_id).filter(Boolean))];
  if(!teamIds.length)return {eligible:true,recipients:0,delivered:0,already_delivered:0,failed:0};

  const{data:teams,error:tErr}=await c.from("fantasy_user_teams").select("id,user_id").eq("season","2026/27").in("id",teamIds);
  if(tErr)throw tErr;
  const userIds=[...new Set((teams||[]).map((t:any)=>t.user_id).filter(Boolean))] as string[];
  const playerName=player?.name||"Spiller";
  const note=String(availability.note||"").trim();
  const message=`${playerName} er markert som ${statusLabel(status)}.${note?` ${note}`:""}`;

  let delivered=0,alreadyDelivered=0,failed=0;
  for(const userId of userIds){
    const{data,error}=await c.rpc("deliver_fantasy_availability_notification_v1",{
      p_user_id:userId,
      p_player_id:playerId,
      p_status:status,
      p_availability_updated_at:availability.updated_at,
      p_title:"Spillerstatus oppdatert",
      p_message:message,
      p_link:"/fantasy/team",
      p_created_by:reviewerId,
    });
    if(error){failed+=1;continue;}
    const result=Array.isArray(data)?data[0]:data;
    if(result?.delivered)delivered+=1;
    else if(result?.reason==="already_delivered")alreadyDelivered+=1;
    else failed+=1;
  }
  return {eligible:true,recipients:userIds.length,delivered,already_delivered:alreadyDelivered,failed};
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  try{
    const c=sb();
    const{data,error}=await c.from("fantasy_availability_findings")
      .select("id,source_kind,source_label,source_url,source_published_at,observed_at,raw_player_name,raw_team,raw_status,raw_note,proposed_player_id,match_method,match_confidence,match_reason,review_status,reviewed_at,review_note,created_at")
      .order("created_at",{ascending:false}).limit(250);
    if(error)throw error;
    const ids=[...new Set((data||[]).map((r:any)=>r.proposed_player_id).filter(Boolean))];
    let playerMap=new Map<string,any>();
    if(ids.length){
      const{data:players,error:pErr}=await c.from("fantasy_players").select("id,name,team,position,active,on_current_roster").in("id",ids);
      if(pErr)throw pErr;playerMap=new Map((players||[]).map((p:any)=>[p.id,p]));
    }
    return NextResponse.json({ok:true,rows:(data||[]).map((r:any)=>({...r,proposed_player:r.proposed_player_id?playerMap.get(r.proposed_player_id)||null:null}))});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke hente availability-funn"},{status:500})}
}

export async function POST(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  try{
    const body=await request.json();
    const sourceKind=String(body.sourceKind||"");
    const sourceLabel=String(body.sourceLabel||"").trim();
    const rawPlayerName=String(body.rawPlayerName||"").trim();
    const rawTeam=String(body.rawTeam||"").trim()||null;
    const rawStatus=String(body.rawStatus||"");
    if(!sourceKinds.has(sourceKind)||!sourceLabel||!rawPlayerName||!statuses.has(rawStatus))return NextResponse.json({ok:false,error:"Ugyldig kilde, spiller eller status"},{status:400});

    const c=sb();
    const{data:players,error:pErr}=await c.from("fantasy_players").select("id,name,team").eq("active",true).eq("on_current_roster",true);
    if(pErr)throw pErr;
    const match=matchAvailabilityFinding(rawPlayerName,rawTeam,(players||[]) as any[]);
    const row={
      source_kind:sourceKind,source_label:sourceLabel,source_url:String(body.sourceUrl||"").trim()||null,
      source_published_at:body.sourcePublishedAt||null,raw_player_name:rawPlayerName,raw_team:rawTeam,raw_status:rawStatus,
      raw_note:String(body.rawNote||"").trim()||null,proposed_player_id:match.proposedPlayerId,match_method:match.matchMethod,
      match_confidence:match.matchConfidence,match_reason:match.matchReason,review_status:match.reviewStatus,created_by:admin.userId
    };
    const{data,error}=await c.from("fantasy_availability_findings").insert(row).select("id,review_status,proposed_player_id,match_confidence,match_reason").single();
    if(error)throw error;
    return NextResponse.json({ok:true,finding:data});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke registrere availability-funn"},{status:500})}
}

export async function PATCH(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  try{
    const body=await request.json();const id=Number(body.id);const reviewStatus=String(body.reviewStatus||"");
    if(!Number.isInteger(id)||id<=0||!reviewStates.has(reviewStatus))return NextResponse.json({ok:false,error:"Ugyldig review-endring"},{status:400});
    const c=sb();

    if(reviewStatus==="approved"){
      const{data,error}=await c.rpc("fantasy_approve_availability_finding",{
        p_finding_id:id,
        p_reviewer_id:admin.userId,
        p_review_note:String(body.reviewNote||"").trim()||null,
      });
      if(error)throw error;
      const approved=Array.isArray(data)?data[0]:data;
      let notifications={eligible:false,recipients:0,delivered:0,already_delivered:0,failed:0};
      if(approved?.player_id&&approved?.status){
        try{notifications=await notifyFantasyOwners(c,String(approved.player_id),String(approved.status),admin.userId)}catch{notifications={eligible:true,recipients:0,delivered:0,already_delivered:0,failed:1}}
      }
      return NextResponse.json({ok:true,approved,notifications});
    }

    const update:any={review_status:reviewStatus,reviewed_at:new Date().toISOString(),reviewed_by:admin.userId,review_note:String(body.reviewNote||"").trim()||null};
    if(body.proposedPlayerId!==undefined){
      const playerId=String(body.proposedPlayerId||"").trim()||null;
      if(playerId){
        const{data:p,error:pErr}=await c.from("fantasy_players").select("id,name,team,active,on_current_roster").eq("id",playerId).eq("active",true).eq("on_current_roster",true).maybeSingle();
        if(pErr)throw pErr;if(!p)return NextResponse.json({ok:false,error:"Valgt spiller finnes ikke i aktiv roster"},{status:400});
      }
      update.proposed_player_id=playerId;update.match_method=playerId?"manual":null;update.match_confidence=playerId?1:null;update.match_reason=playerId?"Manuelt verifisert spillerforslag.":"Spillerforslag fjernet manuelt.";
    }
    const{error}=await c.from("fantasy_availability_findings").update(update).eq("id",id);if(error)throw error;
    return NextResponse.json({ok:true});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke oppdatere review"},{status:500})}
}
