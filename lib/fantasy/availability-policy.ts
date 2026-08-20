export type FantasyAvailabilityStatus="available"|"questionable"|"out"|"long_term"|"returning"|"not_in_lineup";

const OPTIMIZER_BLOCKED=new Set<FantasyAvailabilityStatus>(["out","long_term","not_in_lineup"]);

export function isOptimizerEligibleAvailability(status:string|null|undefined){
  const normalized=(status||"available") as FantasyAvailabilityStatus;
  return !OPTIMIZER_BLOCKED.has(normalized);
}

export function availabilityEligibilityReason(status:string|null|undefined){
  const normalized=(status||"available") as FantasyAvailabilityStatus;
  if(normalized==="out")return "Bekreftet ute";
  if(normalized==="long_term")return "Langtidsskadd";
  if(normalized==="not_in_lineup")return "Ikke i kamptropp";
  return null;
}
