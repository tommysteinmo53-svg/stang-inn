import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {availabilityAdjustmentLabel,availabilityXfpFactor,normalizeFantasyAvailabilityStatus} from "../../../../../lib/fantasy/availability-policy";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const VALUE_DEFINITION={version:"v1",unit:"xFP per million",nextGame:"availability-adjusted xFP next game / price",next3:"availability-adjusted xFP next 3 fixtures / price"};
const BUY_DEFINITION={version:"v2",label:"Kjøp",description:"Forklarbar kjøpsscore basert på availability-justert xFP neste 3, form, verdi per million, neste motstander og datatillit."};
const HOLD_DEFINITION={version:"v1",label:"Hold",description:"Behold-score for spillere du allerede eier. Belønner stabil xFP, form, verdi og datatillit, men straffer availability-risiko og svært svake kommende kamper."};

function userClient(request:NextRequest){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,header=request.headers.get("authorization");if(!url||!key||!header?.startsWith("Bearer "))return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:header}}})}
function serviceClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
const round2=(v:number)=>Math.round(v*100)/100;
const round3=(v:number)=>Math.round(v*1000)/1000;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const valuePerMillion=(xfp:number,price:number)=>price>0?round3(xfp/price):0;
function fixtureRating(factor:number){if(factor<=.85)return{score:1,label:"Svært vanskelig"};if(factor<=.95)return{score:2,label:"Vanskelig"};if(factor<1.05)return{score:3,label:"Nøytral"};if(factor<1.15)return{score:4,label:"Lett"};return{score:5,label:"Svært lett"}}
function buyRecommendation(row:any){
 const xfp3=Number(row.xfp_next3||0),form=Number(row.form_ppg||0),season=Number(row.season_ppg||0),value=Number(row.value_next3||0),fixture=fixtureRating(Number(row.opponent_factor||1)),formRatio=season>0?form/season:1;
 const xfpScore=clamp(xfp3/36,0,1)*40,valueScore=clamp(value/4,0,1)*25,formScore=clamp((formRatio-.7)/.6,0,1)*15,fixtureScore=((fixture.score-1)/4)*10,confidenceScore=row.data_confidence==="high"?10:row.data_confidence==="medium"?6:2;
 const score=round2(xfpScore+valueScore+formScore+fixtureScore+confidenceScore),reasons:string[]=[];
 if(xfp3>=30)reasons.push(`Høy prognose: ${round2(xfp3)} xFP neste 3`);else if(xfp3>=20)reasons.push(`Solid prognose: ${round2(xfp3)} xFP neste 3`);
 if(value>=3)reasons.push(`Sterk verdi: ${round3(value)} xFP per mill.`);else if(value>=2)reasons.push(`God verdi: ${round3(value)} xFP per mill.`);
 if(formRatio>=1.15)reasons.push(`Formen er ${Math.round((formRatio-1)*100)} % over sesongnivå`);
 if(fixture.score>=4)reasons.push(`Gunstig neste motstander: ${row.opponent||"ukjent"} (${fixture.label.toLowerCase()})`);
 if(row.availability_factor<1)reasons.push(String(row.availability_adjustment));
 if(!reasons.length)reasons.push("Jevnt analysegrunnlag uten ett dominerende kjøpssignal");
 return{score,tier:score>=75?"sterkt_kjop":score>=60?"kjop":score>=45?"vurder":"avvent",reasons,fixture_rating:fixture.score,fixture_label:fixture.label,components:{xfp_next3:round2(xfpScore),value:round2(valueScore),form:round2(formScore),fixture:round2(fixtureScore),confidence:round2(confidenceScore)}};
}
function holdRecommendation(row:any){
 const xfp3=Number(row.xfp_next3||0),form=Number(row.form_ppg||0),season=Number(row.season_ppg||0),value=Number(row.value_next3||0),availability=Number(row.availability_factor??1),fixture=fixtureRating(Number(row.opponent_factor||1)),formRatio=season>0?form/season:1;
 const projectionScore=clamp(xfp3/32,0,1)*35;
 const stabilityScore=clamp(1-Math.abs(formRatio-1)/.6,0,1)*20;
 const valueScore=clamp(value/3.5,0,1)*15;
 const fixtureScore=clamp((fixture.score-1)/4,0,1)*10;
 const availabilityScore=clamp(availability,0,1)*15;
 const confidenceScore=row.data_confidence==="high"?5:row.data_confidence==="medium"?3:1;
 const score=round2(projectionScore+stabilityScore+valueScore+fixtureScore+availabilityScore+confidenceScore),reasons:string[]=[];
 if(xfp3>=24)reasons.push(`God videre prognose: ${round2(xfp3)} xFP neste 3`);else if(xfp3>=16)reasons.push(`Brukbar videre prognose: ${round2(xfp3)} xFP neste 3`);
 if(formRatio>=.9&&formRatio<=1.15)reasons.push("Formen er stabil rundt sesongnivå");else if(formRatio>1.15)reasons.push("Formen er bedre enn sesongnivå");else if(formRatio<.8)reasons.push("Formen er tydelig under sesongnivå");
 if(value>=2.5)reasons.push(`Fortsatt god verdi: ${round3(value)} xFP per mill.`);
 if(fixture.score>=3)reasons.push(`Kommende matchup er ${fixture.label.toLowerCase()}`);else reasons.push(`Tøff neste matchup: ${fixture.label.toLowerCase()}`);
 if(availability<1)reasons.push(String(row.availability_adjustment));
 if(!reasons.length)reasons.push("Ingen sterke signaler tilsier et umiddelbart bytte");
 const tier=score>=75?"klart_hold":score>=60?"hold":score>=45?"vurder":"svakt_hold";
 return{score,tier,reasons,fixture_rating:fixture.score,fixture_label:fixture.label,components:{projection:round2(projectionScore),stability:round2(stabilityScore),value:round2(valueScore),fixture:round2(fixtureScore),availability:round2(availabilityScore),confidence:round2(confidenceScore)}};
}

export async function GET(request:NextRequest){
 const admin=await requireFantasyAdmin(request);if(!admin.ok)return admin.response;
 const sb=userClient(request),service=serviceClient();if(!sb)return NextResponse.json({ok:false,error:"Supabase-konfigurasjon mangler."},{status:503});if(!service)return NextResponse.json({ok:false,error:"Supabase server-konfigurasjon mangler."},{status:503});
 const[{data,error},{data:availability,error:availabilityError}]=await Promise.all([sb.rpc("get_fantasy_recommendation_data_admin_v1",{p_season:"2026/27"}),service.from("fantasy_player_availability").select("player_id,status,note,expected_return")]);
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500});if(availabilityError)return NextResponse.json({ok:false,error:availabilityError.message},{status:500});
 const availabilityMap=new Map((availability||[]).map((r:any)=>[r.player_id,r]));
 const rows=(data||[]).map((row:any)=>{
  const a:any=availabilityMap.get(row.player_id)||null,status=normalizeFantasyAvailabilityStatus(a?.status),factor=availabilityXfpFactor(status),price=Number(row.price||0),baseNext=Number(row.xfp_next_game||0),baseNext3=Number(row.xfp_next3||0),adjustedNext=round2(baseNext*factor),adjustedNext3=round2(baseNext3*factor),actualGames=Number(row.games_scored||0),baselineEligible=row.data_confidence!=="low"?Math.max(5,actualGames):actualGames;
  const enriched:any={...row,price,actual_games_scored:actualGames,games_scored:factor===0?0:baselineEligible,base_xfp_next_game:baseNext,base_xfp_next3:baseNext3,base_value_next_game:valuePerMillion(baseNext,price),base_value_next3:valuePerMillion(baseNext3,price),xfp_next_game:adjustedNext,xfp_next3:adjustedNext3,value_next_game:valuePerMillion(adjustedNext,price),value_next3:valuePerMillion(adjustedNext3,price),value_metric_version:VALUE_DEFINITION.version,value_unit:VALUE_DEFINITION.unit,availability_status:status,availability_factor:factor,availability_note:a?.note||null,availability_expected_return:a?.expected_return||null,availability_adjustment:availabilityAdjustmentLabel(status)};
  return{...enriched,buy:buyRecommendation(enriched),hold:holdRecommendation(enriched)};
 });
 return NextResponse.json({ok:true,valueDefinition:VALUE_DEFINITION,buyDefinition:BUY_DEFINITION,holdDefinition:HOLD_DEFINITION,rows});
}
