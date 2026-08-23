export function normalizeOptimizerTransferLimit(value: unknown){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(4,Math.trunc(n))):0;
}

export function parseLockedPlayerIds(value: string|null){
  if(!value)return new Set<string>();
  return new Set(value.split(",").map(v=>v.trim()).filter(Boolean));
}

export function optimizerTransferReason(maxTransfers:number,used:number,remaining:number){
  if(maxTransfers===0)return "Permanente transfers er sperret i denne runden.";
  if(maxTransfers===4)return `Bytteboost aktiv: ${remaining} av 4 bytter gjenstår (${used} brukt).`;
  return `${remaining} av 2 ordinære bytter gjenstår (${used} brukt).`;
}
