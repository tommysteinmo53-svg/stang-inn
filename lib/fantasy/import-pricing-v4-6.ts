import type {ImportHistory} from "./import-history-2026";
import {importEstimateV43,type ImportEstimateV43,type V43Position} from "./import-pricing-v4-3";
import {empiricalCalibrationV458} from "./empirical-calibration-v4-5-8";

export type ImportEstimateV46=ImportEstimateV43&{
  baseV43:number;
  empiricalDelta:number;
  empiricalWeight:number;
  empiricalBasis:string;
  productionCandidate:true;
};

const JUNIOR=new Set(["J20 Nationell","Norway U20","Norway U18","NAHL","USHL"]);
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
const BOUNDS:Record<V43Position,[number,number]>={C:[3.5,18],W:[3,18],D:[2,14],G:[4,17]};

function trackFor(history:ImportHistory){
  if(JUNIOR.has(history.league))return "junior/talent" as const;
  if(history.league==="Norway2")return "norway2-transition" as const;
  return "senior-import" as const;
}

// V4.6 candidate rules are based on V4.5.9 leave-one-out validation:
// - senior imports improved materially, so they receive the empirical adjustment;
// - Norway2 was already strong in V4.3.3, so only a small fraction is used;
// - junior/talent worsened in LOO, so empirical calibration is disabled there.
export function importEstimateV46(history:ImportHistory,pos:V43Position,currentTeam?:string,playerName?:string):ImportEstimateV46|null{
  const base=importEstimateV43(history,pos,currentTeam,playerName);
  if(!base)return null;
  const track=trackFor(history);
  const cal=empiricalCalibrationV458(history,pos,base.raw);
  let delta=0,weight=0,basis="V4.3.3 beholdt";
  if(track==="senior-import"){
    delta=clamp(cal.deltaM,-1.5,1.5);
    weight=cal.adjustmentWeight;
    basis=cal.basis;
  }else if(track==="norway2-transition"){
    delta=clamp(cal.deltaM*0.25,-0.30,0.30);
    weight=cal.adjustmentWeight*0.25;
    basis=`Norway2 guardrail 25% · ${cal.basis}`;
  }else{
    delta=0;
    weight=0;
    basis="Junior/talent: empirisk kalibrering deaktivert etter svak LOO-test";
  }
  const [lo,hi]=BOUNDS[pos];
  const raw=clamp(base.raw+delta,lo,hi);
  return {...base,raw,note:`V4.6 kandidat · ${track}`,baseV43:base.raw,empiricalDelta:raw-base.raw,empiricalWeight:weight,empiricalBasis:basis,productionCandidate:true};
}
