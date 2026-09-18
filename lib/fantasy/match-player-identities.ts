// Reviewed 2026-09-17 against HockeyLive 8393581 and the existing priced roster.
// Keep internal UUIDs, ownership, prices and historical external IDs unchanged.
const REVIEWED_MATCH_IDENTITIES:Record<string,string>={
 "nif:10593261":"ep:21651", // Ludwig Rolf Tage Blomstrand, Stavanger
 "nif:10603500":"nif:7738552", // Pathrik Westerholm, Vålerenga
 "nif:10603533":"nif:7738536", // Ponthus Westerholm, Vålerenga
};
export function canonicalMatchPlayerExternalId(externalId:string){return REVIEWED_MATCH_IDENTITIES[externalId]||externalId}
