export type FantasyAvailabilityStatus="available"|"questionable"|"out"|"long_term"|"returning"|"not_in_lineup";

const OPTIMIZER_BLOCKED=new Set<FantasyAvailabilityStatus>(["out","long_term","not_in_lineup"]);
const AVAILABILITY_XFP_FACTOR:Record<FantasyAvailabilityStatus,number>={
  available:1,
  returning:.85,
  questionable:.60,
  out:0,
  long_term:0,
  not_in_lineup:0,
};

export function normalizeFantasyAvailabilityStatus(status:string|null|undefined):FantasyAvailabilityStatus{
  if(status==="questionable"||status==="out"||status==="long_term"||status==="returning"||status==="not_in_lineup")return status;
  return "available";
}

export function isOptimizerEligibleAvailability(status:string|null|undefined){
  return !OPTIMIZER_BLOCKED.has(normalizeFantasyAvailabilityStatus(status));
}

export function availabilityXfpFactor(status:string|null|undefined){
  return AVAILABILITY_XFP_FACTOR[normalizeFantasyAvailabilityStatus(status)];
}

export function availabilityEligibilityReason(status:string|null|undefined){
  const normalized=normalizeFantasyAvailabilityStatus(status);
  if(normalized==="out")return "Bekreftet ute";
  if(normalized==="long_term")return "Langtidsskadd";
  if(normalized==="not_in_lineup")return "Ikke i kamptropp";
  return null;
}

export function availabilityAdjustmentLabel(status:string|null|undefined){
  const normalized=normalizeFantasyAvailabilityStatus(status);
  if(normalized==="questionable")return "Usikker tilgjengelighet · 60 % xFP";
  if(normalized==="returning")return "Tilbake/retur · 85 % xFP";
  if(normalized==="out")return "Bekreftet ute · 0 % xFP";
  if(normalized==="long_term")return "Langtidsskadd · 0 % xFP";
  if(normalized==="not_in_lineup")return "Ikke i kamptropp · 0 % xFP";
  return "Tilgjengelig · 100 % xFP";
}
