import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireFantasyAdmin} from "../../../../../lib/fantasy/admin-auth";
import {calculate19FantasyPoints} from "../../../../../lib/fantasy/scoring";

const SEASON="2026/27";

function n(v:unknown){const x=Number(v);return Number.isFinite(x)?x:0}

export async function GET(request:NextRequest){
 const auth=await requireFantasyAdmin(request);if(!auth.ok)return auth.response;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)return NextResponse.json({ok:false,error:"Supabase server-konfigurasjon mangler."},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const{data,error}=await db.from("fantasy_scoring_rules").select("key,points,active,position").eq("season",SEASON).eq("active",true);
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
 const global=new Map((data||[]).filter((r:any)=>r.position==null||r.position==="").map((r:any)=>[String(r.key),n(r.points)]));
 const config={
  powerplayGoalBonus:global.get("powerplay_goal_bonus")??0,
  powerplayAssistBonus:global.get("powerplay_assist_bonus")??0,
  shorthandedGoalBonus:global.get("shorthanded_goal_bonus")??0,
  shorthandedAssistBonus:global.get("shorthanded_assist_bonus")??0,
  faceoffWinPoints:global.get("faceoff_win_points")??0,
  faceoffWinBonus:global.get("faceoff_win_bonus")??0,
 };
 const ppGoal=calculate19FantasyPoints({position:"W",didPlay:true,goals:1,powerplayGoals:1},config);
 const ppAssist=calculate19FantasyPoints({position:"W",didPlay:true,assists:1,powerplayAssists:1},config);
 const shGoal=calculate19FantasyPoints({position:"W",didPlay:true,goals:1,shorthandedGoals:1},config);
 const shAssist=calculate19FantasyPoints({position:"W",didPlay:true,assists:1,shorthandedAssists:1},config);
 const faceoffs=calculate19FantasyPoints({position:"C",didPlay:true,faceoffsWon:8,faceoffsTaken:12},config);
 const checks=[
  {check_no:1,check_name:"PP-mål gir +2 bonus",passed:config.powerplayGoalBonus===2&&ppGoal.powerplayGoals===2&&ppGoal.total===14,detail:`goal=10 participation=2 PP=${ppGoal.powerplayGoals} total=${ppGoal.total}`},
  {check_no:2,check_name:"PP-assist gir +1 bonus",passed:config.powerplayAssistBonus===1&&ppAssist.powerplayAssists===1&&ppAssist.total===9,detail:`assist=6 participation=2 PP=${ppAssist.powerplayAssists} total=${ppAssist.total}`},
  {check_no:3,check_name:"SH-mål og SH-assist gir +6/+4",passed:config.shorthandedGoalBonus===6&&config.shorthandedAssistBonus===4&&shGoal.shorthandedGoals===6&&shAssist.shorthandedAssists===4&&shGoal.total===18&&shAssist.total===12,detail:`SH goal total=${shGoal.total} · SH assist total=${shAssist.total}`},
  {check_no:4,check_name:"Vunnet dropp gir 0,25 per seier",passed:config.faceoffWinPoints===0.25&&faceoffs.faceoffsWon===2&&faceoffs.total===4,detail:`8 wins × 0.25=${faceoffs.faceoffsWon} + participation=2 total=${faceoffs.total}`},
  {check_no:5,check_name:"Testen er skrivefri",passed:true,detail:"Kun SELECT mot fantasy_scoring_rules; ingen testdata opprettet eller endret."},
 ];
 return NextResponse.json({ok:checks.every(c=>c.passed),season:SEASON,config,checks});
}
