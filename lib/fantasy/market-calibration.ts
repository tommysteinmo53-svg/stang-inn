export const TEAM_BUDGET_M = 100;
export const DEFAULT_ROSTER_SIZE = 10;
export const TARGET_AVG_PRICE_M = TEAM_BUDGET_M / DEFAULT_ROSTER_SIZE;
export const MAX_AVG_INFLATION = 0.03;

export function half(x:number){return Math.round(x*2)/2}
export function clamp(x:number,lo:number,hi:number){return Math.max(lo,Math.min(hi,x))}

// Continuous 0–100 signal: how strongly performance says the old fantasy price is stale.
export function repricingScore(r:{old:number;ppg:number;games:number;position?:string}){
  const games=Number(r.games||0), ppg=Number(r.ppg||0), old=Number(r.old||0);
  const reliability=clamp(games/40,0.15,1);
  const expectedPpg=Math.max(1,old*0.72);
  const performanceGap=(ppg-expectedPpg)/Math.max(2,expectedPpg);
  const cheapBreakout=old<=5?clamp((ppg-5)/7,0,1):0;
  const expensiveMiss=old>=10?clamp((old*0.55-ppg)/7,0,1):0;
  const goaliePenalty=r.position==='G'?0.05:0;
  return Math.round(clamp((0.45+0.34*performanceGap+0.28*cheapBreakout+0.18*expensiveMiss-goaliePenalty)*reliability,0.02,0.98)*100);
}

// Calibrate the entire player market so a 100m team budget remains meaningful.
// We preserve relative player ranking while preventing broad price inflation.
export function calibrateMarket<T extends {old:number;rawEst:number}>(rows:T[]){
  if(!rows.length)return {rows:[] as (T&{est:number;marketSharePct:number;budgetSharePct:number})[],stats:{oldAvg:0,rawAvg:0,calibratedAvg:0,scale:1,totalOld:0,totalRaw:0,totalCalibrated:0,targetAvg:0}};
  const totalOld=rows.reduce((s,r)=>s+r.old,0), totalRaw=rows.reduce((s,r)=>s+r.rawEst,0);
  const oldAvg=totalOld/rows.length, rawAvg=totalRaw/rows.length;
  // Historical market average is the anchor. Allow max +3% inflation year-to-year.
  const targetAvg=Math.min(rawAvg,oldAvg*(1+MAX_AVG_INFLATION));
  const scale=rawAvg>0?Math.min(1,targetAvg/rawAvg):1;
  const first=rows.map(r=>({...r,est:half(clamp(r.rawEst*scale,1,20))}));
  const totalCalibrated=first.reduce((s,r)=>s+r.est,0), calibratedAvg=totalCalibrated/first.length;
  return {rows:first.map(r=>({...r,marketSharePct:totalCalibrated?100*r.est/totalCalibrated:0,budgetSharePct:100*r.est/TEAM_BUDGET_M})),stats:{oldAvg,rawAvg,calibratedAvg,scale,totalOld,totalRaw,totalCalibrated,targetAvg}};
}
