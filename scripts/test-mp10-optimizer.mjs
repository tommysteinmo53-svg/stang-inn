import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const exists=(p)=>fs.existsSync(p);
const route=read("app/api/admin/fantasy/transfer-optimizer/route.ts");
const page=read("app/fantasy/admin-analysis/optimizer/page.tsx");
const nav=read("app/fantasy/FantasyNav.tsx");
const helper=read("lib/fantasy/optimizer-transfer-policy.ts");
const adminOnlySql=read("supabase/mp10-admin-only-optimizer-v1.sql");
const transferRules=read("docs/FANTASY_TRANSFER_RULES.md");

const checks=[];
function must(name,condition){checks.push({name,ok:Boolean(condition)});if(!condition)throw new Error(`MP-10 regression failed: ${name}`)}

must("public optimizer page removed",!exists("app/fantasy/optimizer/page.tsx"));
must("public optimizer API removed",!exists("app/api/fantasy/transfer-optimizer/route.ts"));
must("fantasy navigation hides optimizer",!nav.includes('/fantasy/optimizer'));
must("admin optimizer page retained",page.includes('/api/admin/fantasy/transfer-optimizer'));
must("admin optimizer keeps locked IDs",page.includes('qs.set("locked",Array.from(nextLocked).join(","))'));
must("optimizer xFP compatibility RPC is admin-only",adminOnlySql.includes("p.admin=true")&&adminOnlySql.includes("get_fantasy_xfp_round_horizons_v1"));
must("optimizer economy compatibility RPC is admin-only",adminOnlySql.includes("p.admin=true")&&adminOnlySql.includes("get_fantasy_economy_v1"));
must("anon has no optimizer helper execute",adminOnlySql.includes("revoke all on function public.get_fantasy_xfp_round_horizons_v1(text) from public, anon")&&adminOnlySql.includes("revoke all on function public.get_fantasy_economy_v1(text) from public, anon"));
must("authoritative transfer status retained",route.includes('get_fantasy_transfer_status_v1'));
must("old hard cap of two removed",!route.includes('Math.min(2,Number(statusRow.transfers_remaining'));
must("0/2/4 transfer limit normalized from RPC",route.includes('normalizeOptimizerTransferLimit(statusRow.transfers_remaining)'));
must("Bytteboost search is bounded",route.includes('SEARCH_CAP:Record<Pos,number>={G:5,D:8,F:10}')&&route.includes('boundedIncomingPool'));
must("server reads locked-player constraint",route.includes('parseLockedPlayerIds(request.nextUrl.searchParams.get("locked"))'));
must("invalid locked player rejected",route.includes('Låste spillere må tilhøre ditt nåværende Fantasy-lag'));
must("locked players excluded from outgoing pool",route.includes('current.filter(p=>!lockedIds.has(p.id))'));
must("authoritative availability table retained",route.includes('fantasy_player_availability'));
must("blocked availability gate retained",route.includes('isOptimizerEligibleAvailability(availabilityStatus)'));
must("balanced strategy retained",route.includes('balanced:'));
must("conservative strategy retained",route.includes('conservative:'));
must("offensive strategy retained",route.includes('offensive:'));
must("helper allows Bytteboost four-transfer maximum",helper.includes('Math.min(4'));
must("final rules document says normal max two",transferRules.includes('maks 2 permanente spillerbytter per ordinær fantasy-runde'));
must("final rules document says Bytteboost four",transferRules.includes('Bytteboost')&&transferRules.includes('4 bytter'));
must("final rules document blocks permanent Event Week transfers",transferRules.includes('Permanente transfers er sperret')&&transferRules.includes('Rik Onkel')&&transferRules.includes('Fattig Onkel'));

console.log(`MP-10 optimizer regression: ${checks.length}/${checks.length} checks passed.`);
