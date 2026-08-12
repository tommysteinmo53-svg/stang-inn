import { clamp } from "./market-calibration";
import type { ImportHistory } from "./import-history-2026";

export type V43Position = "C" | "W" | "D" | "G";
export type ImportEstimateV43 = { raw:number; prior:number; weight:number; translation:number; confidence:"Høy"|"Middels"|"Lav"; metric:string; note:string };

export const NEW_PLAYER_PRIOR_M: Record<V43Position, number> = { C:6.5, W:6.0, D:4.5, G:7.0 };
export const LEAGUE_TRANSLATION_V43: Record<string, number> = {
  NHL:1.08,AHL:1.04,SHL:1.00,Liiga:0.98,NL:0.98,DEL:0.92,HockeyAllsvenskan:0.78,ICEHL:0.76,Slovakia:0.75,ECHL:0.72,EIHL:0.70,"Metal Ligaen":0.66,Poland:0.62,Mestis:0.62,Latvia:0.62,HockeyEttan:0.56,USHL:0.50,NAHL:0.44,Norway2:0.45,"J20 Nationell":0.36,"Norway U20":0.30,"Norway U18":0.22,
};
const BOUNDS: Record<V43Position,[number,number]>={C:[3.5,18],W:[3,18],D:[2,14],G:[4,17]};

function leaguePriorAdjustment(league:string,pos:V43Position){
  const t=LEAGUE_TRANSLATION_V43[league]??0.5;
  const premium=t>=0.98?3.25:t>=0.9?2.5:t>=0.75?1.5:t>=0.6?0.75:t>=0.5?0.25:0;
  return premium*(pos==="G"?1.12:1);
}

// V4.3.2: recruitment context is an expectation prior, not a blanket club multiplier.
// Established contenders typically use senior imports in meaningful roles; this prevents
// strong-league signings from being priced like generic newcomers when their old league P/GP
// understates the role they are expected to have in EHL.
function expectedRoleAdjustment(team:string|undefined, league:string, pos:V43Position){
  if(!team) return 0;
  const t=LEAGUE_TRANSLATION_V43[league]??0.5;
  const contender=["Storhamar","Stavanger","Vålerenga","Frisk Asker"].includes(team);
  if(contender && t>=0.9) return pos==="G"?1.0:2.4;
  if(contender && t>=0.75) return pos==="G"?0.8:1.7;
  if(contender && t>=0.6) return pos==="G"?0.6:1.0;
  if(team==="Narvik" && t>=0.75) return pos==="G"?0.5:1.15;
  if(team==="Sparta" && t>=0.75) return pos==="G"?0.4:0.65;
  return 0;
}

function sampleWeight(games:number,junior=false){const base=clamp(games/45,0.18,0.82);return junior?base*0.65:base}
function nonlinearDelta(value:number,limit:number){return limit*(value/(1+Math.abs(value)))}

export function importEstimateV43(history:ImportHistory,pos:V43Position,currentTeam?:string):ImportEstimateV43|null{
  const translation=LEAGUE_TRANSLATION_V43[history.league]; if(translation==null)return null;
  const junior=/U18|U20|J20|NAHL|USHL/i.test(history.league);
  const prior=NEW_PLAYER_PRIOR_M[pos]+leaguePriorAdjustment(history.league,pos)+expectedRoleAdjustment(currentTeam,history.league,pos);
  const [lo,hi]=BOUNDS[pos];
  if(history.kind==="goalie"){
    if(pos!=="G"||history.games<8||!Number.isFinite(history.savePct)||!Number.isFinite(history.gaa))return null;
    const w=sampleWeight(history.games,junior); const quality=((history.savePct-0.905)*100*0.55)-((history.gaa-2.6)*0.28);
    const raw=clamp(prior+nonlinearDelta(quality,4)*translation*w,lo,hi);
    return {raw,prior,weight:w,translation,confidence:history.games>=30&&translation>=0.75?"Middels":"Lav",metric:`${(history.savePct*100).toFixed(1)} SV% · ${history.gaa.toFixed(2)} GAA`,note:junior?"Junior/talentgrunnlag med sterk regresjon":"Importmodell V4.3.2"};
  }
  if(pos==="G"||history.games<10)return null;
  const ppg=history.points/history.games, expected=pos==="D"?0.30:0.58, scale=pos==="D"?5:5.8, w=sampleWeight(history.games,junior);
  let delta=nonlinearDelta((ppg-expected)*scale,pos==="D"?3:4)*translation*w;
  if(history.league==="Norway2"&&currentTeam==="Ringerike")delta*=0.72;
  const raw=clamp(prior+delta,lo,hi);
  return {raw,prior,weight:w,translation,confidence:history.games>=40&&translation>=0.75?"Middels":"Lav",metric:`${ppg.toFixed(2)} P/GP`,note:junior?"Talentmodell V4.3.2":"Importmodell V4.3.2"};
}

export type TalentHistoryV43={name:string;position:V43Position;league:"Norway U18"|"Norway U20"|"J20 Nationell";games:number;goals?:number;assists?:number;points?:number;savePct?:number;gaa?:number;sourceNote:string};
export const TALENT_HISTORY_2026_V43:TalentHistoryV43[]=[
{name:"Victor Slettebråten Karadas",position:"D",league:"Norway U18",games:42,goals:25,assists:25,points:50,sourceNote:"Documented U18 production across 2023–26; only 3 Norway2 senior games in 2025/26."},
{name:"Matheo Werner Dubec",position:"W",league:"Norway U18",games:5,goals:6,assists:2,points:8,sourceNote:"2025/26 U18 playoff sample; one EHL appearance. Kept very low confidence."},
{name:"Sondre Berg",position:"D",league:"Norway U18",games:2,goals:0,assists:0,points:0,sourceNote:"Thin senior sample; U18 national-team context. Price should stay close to new-player prior."},];
function talentCeiling(t:TalentHistoryV43){if(t.league==="Norway U18"){if(t.position==="G")return 6.5;if(t.position==="D")return 4.5;return 5}if(t.league==="Norway U20")return t.position==="G"?7:t.position==="D"?5:6;return t.position==="G"?7:t.position==="D"?5.5:6}
export function talentEstimateV43(t:TalentHistoryV43):ImportEstimateV43{
 const prior=NEW_PLAYER_PRIOR_M[t.position]-(t.position==="G"?0.5:0.75),translation=LEAGUE_TRANSLATION_V43[t.league],[lo,hi]=BOUNDS[t.position],ceiling=Math.min(hi,talentCeiling(t)),w=sampleWeight(t.games,true);
 if(t.position==="G"&&Number.isFinite(t.savePct)&&Number.isFinite(t.gaa)){const quality=(((t.savePct as number)-0.905)*100*0.45)-(((t.gaa as number)-2.6)*0.2);return{raw:clamp(prior+nonlinearDelta(quality,2)*translation*w,lo,ceiling),prior,weight:w,translation,confidence:"Lav",metric:`${((t.savePct as number)*100).toFixed(1)} SV%`,note:"Talentmodell V4.3.2"}}
 const ppg=t.games>0?Number(t.points||0)/t.games:0,expected=t.position==="D"?0.45:0.75,signal=(ppg-expected)*(t.position==="D"?2.5:3);
 return{raw:clamp(prior+nonlinearDelta(signal,1.8)*translation*w,lo,ceiling),prior,weight:w,translation,confidence:"Lav",metric:`${ppg.toFixed(2)} P/GP junior`,note:"Talentmodell V4.3.2"};
}
