import type { ImportHistory } from "./import-history-2026";
import type { V43Position } from "./import-pricing-v4-3";

export type EmpiricalImportPriorV45 = {
  fpPerGame:number;
  startPriceM:number;
  sampleN:number;
  basis:string;
  confidence:"Middels"|"Lav";
};

const POS_BASE:Record<"F"|"D"|"G",EmpiricalImportPriorV45>={
  F:{fpPerGame:10.73,startPriceM:15.5,sampleN:11,basis:"Seniorimport-forwarder 2025/26",confidence:"Middels"},
  D:{fpPerGame:8.93,startPriceM:10.2,sampleN:6,basis:"Seniorimport-backer 2025/26",confidence:"Lav"},
  G:{fpPerGame:10.44,startPriceM:16.0,sampleN:2,basis:"Seniorimport-keepere 2025/26",confidence:"Lav"},
};

const LEAGUE_POS:Record<string,EmpiricalImportPriorV45>={
  "HockeyAllsvenskan|D":{fpPerGame:10.66,startPriceM:11.0,sampleN:4,basis:"HockeyAllsvenskan-back → EHL",confidence:"Middels"},
  "HockeyAllsvenskan|G":{fpPerGame:10.44,startPriceM:16.0,sampleN:2,basis:"HockeyAllsvenskan-keeper → EHL",confidence:"Lav"},
  "HockeyEttan|F":{fpPerGame:9.65,startPriceM:12.0,sampleN:2,basis:"HockeyEttan-forward → EHL",confidence:"Lav"},
};

export function empiricalImportPriorV45(history:ImportHistory,pos:V43Position):EmpiricalImportPriorV45{
  const group: "F"|"D"|"G" = pos==="G"?"G":pos==="D"?"D":"F";
  if(history.league==="Norway2"){
    if(group==="D") return {fpPerGame:4.40,startPriceM:5.0,sampleN:5,basis:"Norway2-back → EHL kontrollgruppe",confidence:"Middels"};
    if(group==="F") return {fpPerGame:4.34,startPriceM:6.0,sampleN:5,basis:"Norway2-forward → EHL kontrollgruppe",confidence:"Middels"};
  }
  return LEAGUE_POS[`${history.league}|${group}`] ?? POS_BASE[group];
}
