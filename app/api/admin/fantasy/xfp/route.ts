import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityAdjustmentLabel,availabilityXfpFactor,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const VALUE_DEFINITION={version:"v2",unit:"xFP per million",nextGame:"availability-adjusted xFP next game / price",next3:"availability-adjusted xFP next 3 fantasy rounds / price"};

function clientFor(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,header=request.headers.get("authorization");
  if(!url||!key||!header?.startsWith("Bearer "))return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}});
}
function serviceClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
const round2=(v:number)=>Math.round(v*100)/100;
const round3=(v:number)=>Math.round(v*1000)/1000;
const valuePerMillion=(xfp:number,price:number)=>price>0?round3(xfp/price):0;

function legacyRows(rows:any[],availability:any[]){
  const map=new Map((availability||[]).map((r:any)=>[r.player_id,r]));
  return(rows||[]).map((row:any)=>{
    const a:any=map.get(row.player_id)||null;
    const status=normalizeFantasyAvailabilityStatus(a?.status),factor=availabilityXfpFactor(status),price=Number(row.price||0);
    const baseNext=Number(row.base_xfp_next_game||0),baseNext3=Number(row.base_xfp_next3_rounds||0);
    const adjustedNext=round2(baseNext*factor),adjustedNext3=round2(baseNext3*factor);
    return{
      player_id:row.player_id,player_name:row.player_name,team:row.team,player_position:row.player_position,price,
      games_scored:row.data_confidence==="low"?0:5,season_ppg:Number(row.season_ppg||0),form_ppg:Number(row.form_ppg||0),venue_ppg:Number(row.season_ppg||0),
      opponent:row.next_opponent||null,next_game_at:row.next_game_at||null,is_home:row.next_is_home??null,opponent_factor:1,
      next3_games:Number(row.next3_round_games||0),xfp_next_game:adjustedNext,xfp_next3:adjustedNext3,value_next3:valuePerMillion(adjustedNext3,price),data_confidence:row.data_confidence,
      base_xfp_next_game:baseNext,base_xfp_next3:baseNext3,base_value_next_game:valuePerMillion(baseNext,price),base_value_next3:valuePerMillion(baseNext3,price),
      value_next_game:valuePerMillion(adjustedNext,price),value_metric_version:VALUE_DEFINITION.version,value_unit:VALUE_DEFINITION.unit,
      availability_status:status,availability_factor:factor,availability_note:a?.note||null,availability_expected_return:a?.expected_return||null,availability_adjustment:availabilityAdjustmentLabel(status),
      next_round_no:row.next_round_no,next_round_name:row.next_round_name,next_round_games:Number(row.next_round_games||0),base_xfp_next_round:Number(row.base_xfp_next_round||0),adjusted_xfp_next_round:round2(Number(row.base_xfp_next_round||0)*factor),
    };
  });
}

async function loadFast(sb:any,service:any){
  const[{data:settings,error:settingsError},{data:rows,error:rowsError},{data:availability,error:availabilityError}]=await Promise.all([
    sb.rpc("get_fantasy_xfp_settings_admin_v1",{p_season:"2026/27"}),
    sb.rpc("get_fantasy_xfp_round_horizons_admin_v2",{p_season:"2026/27"}),
    service.from("fantasy_player_availability").select("player_id,status,note,expected_return"),
  ]);
  if(settingsError)throw settingsError;if(rowsError)throw rowsError;if(availabilityError)throw availabilityError;
  return{settings:settings?.[0]||null,rows:legacyRows(rows||[],availability||[])};
}

export async function GET(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  const sb=clientFor(request),service=serviceClient();if(!sb||!service)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  const playerId=request.nextUrl.searchParams.get("playerId");
  if(playerId){
    const[{data,error},{data:availability,error:availabilityError}]=await Promise.all([
      sb.rpc("get_fantasy_xfp_player_fixtures_admin_v1",{p_player_id:playerId,p_season:"2026/27"}),
      service.from("fantasy_player_availability").select("player_id,status,note,expected_return").eq("player_id",playerId).maybeSingle(),
    ]);
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
    const status=normalizeFantasyAvailabilityStatus((availability as any)?.status),factor=availabilityXfpFactor(status);
    return NextResponse.json({ok:true,fixtures:(data||[]).map((row:any)=>({...row,base_fixture_xfp:Number(row.fixture_xfp||0),fixture_xfp:round2(Number(row.fixture_xfp||0)*factor),availability_status:status,availability_factor:factor,availability_adjustment:availabilityAdjustmentLabel(status)}))});
  }
  try{const data=await loadFast(sb,service);return NextResponse.json({ok:true,...data,valueDefinition:VALUE_DEFINITION})}catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke hente xFP"},{status:500})}
}

export async function POST(request:NextRequest){
  const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
  const sb=clientFor(request),service=serviceClient();if(!sb||!service)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});
  let body:any;try{body=await request.json()}catch{return NextResponse.json({ok:false,error:"Ugyldig request."},{status:400})}
  const weights=[body?.seasonWeight,body?.formWeight,body?.venueWeight,body?.opponentWeight].map(Number);
  if(weights.some(v=>!Number.isFinite(v))||weights.some(v=>v<0||v>100))return NextResponse.json({ok:false,error:"Ugyldige vekter."},{status:400});
  if(Math.abs(weights.reduce((a,b)=>a+b,0)-100)>0.001)return NextResponse.json({ok:false,error:"Vektene må summere til 100 %."},{status:400});
  const{error}=await sb.rpc("save_fantasy_xfp_settings_admin_v1",{p_season:"2026/27",p_season_weight:weights[0]/100,p_form_weight:weights[1]/100,p_venue_weight:weights[2]/100,p_opponent_weight:weights[3]/100});
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  try{const data=await loadFast(sb,service);return NextResponse.json({ok:true,...data,valueDefinition:VALUE_DEFINITION})}catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Kunne ikke hente xFP"},{status:500})}
}
