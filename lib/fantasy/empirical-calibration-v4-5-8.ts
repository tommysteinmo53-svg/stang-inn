import type { ImportHistory } from "./import-history-2026";
import type { V43Position } from "./import-pricing-v4-3";
import { empiricalImportPriorV45 } from "./empirical-import-priors-v4-5";

export type EmpiricalCalibrationV458={
  rawPriorM:number;
  adjustmentWeight:number;
  recommendedM:number;
  deltaM:number;
  confidence:"Middels"|"Lav";
  basis:string;
};

const JUNIOR=new Set(["J20 Nationell","Norway U20","Norway U18"]);
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
const group=(p:V43Position)=>p==="G"?"G":p==="D"?"D":"F";

// Production sensitivity is intentionally conservative. Norway2 has the strongest
// transition cohort but only weak P/GP -> EHL FP/K correlation (~0.29), while most
// senior league x position samples remain small. The empirical layer therefore
// adjusts around V4.3.3 rather than replacing it.
function skaterProductionShift(history:ImportHistory,pos:V43Position){
  if(history.kind!=="skater"||history.games<=0)return 0;
  const ppg=history.points/history.games;
  if(history.league==="Norway2"){
    const expected=pos==="D"?0.60:1.05;
    return clamp((ppg-expected)*(pos==="D"?2.0:1.6),-1.5,1.5);
  }
  if(JUNIOR.has(history.league)){
    const expected=pos==="D"?0.55:0.80;
    return clamp((ppg-expected)*(pos==="D"?0.9:0.8),-0.6,0.6);
  }
  const expected=pos==="D"?0.40:0.60;
  return clamp((ppg-expected)*(pos==="D"?2.2:1.8),-1.75,1.75);
}

function goalieProductionShift(history:ImportHistory){
  if(history.kind!=="goalie")return 0;
  const sv=(history.savePct-0.895)*100*0.22;
  const gaa=(2.8-history.gaa)*0.18;
  return clamp(sv+gaa,-1.0,1.0);
}

function empiricalWeight(sampleN:number,track:"junior"|"norway2"|"senior",pos:V43Position){
  if(sampleN<=0)return 0.08;
  const base=track==="norway2"?0.38:track==="junior"?0.18:0.30;
  const nFactor=clamp(sampleN/6,0.25,1);
  const goaliePenalty=pos==="G"?0.65:1;
  return clamp(base*nFactor*goaliePenalty,0.08,0.38);
}

export function empiricalCalibrationV458(history:ImportHistory,pos:V43Position,v43M:number):EmpiricalCalibrationV458{
  const prior=empiricalImportPriorV45(history,pos);
  const track=JUNIOR.has(history.league)?"junior":history.league==="Norway2"?"norway2":"senior";
  const productionShift=group(pos)==="G"?goalieProductionShift(history):skaterProductionShift(history,pos);
  const rawPriorM=prior.startPriceM+productionShift;
  const adjustmentWeight=empiricalWeight(prior.sampleN,track,pos);
  // Extra safety cap: this diagnostic layer may move V4.3.3 by at most 1.5m.
  const deltaM=clamp((rawPriorM-v43M)*adjustmentWeight,-1.5,1.5);
  return {
    rawPriorM,
    adjustmentWeight,
    recommendedM:v43M+deltaM,
    deltaM,
    confidence:prior.confidence,
    basis:`${prior.basis} · produksjonsfølsom V4.5.8 · N=${prior.sampleN}`,
  };
}
