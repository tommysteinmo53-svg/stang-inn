import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const route=read("app/api/admin/fantasy/transfer-optimizer/route.ts");
const page=read("app/fantasy/admin-analysis/optimizer/page.tsx");
const helper=read("lib/fantasy/optimizer-transfer-policy.ts");
const transferRules=read("docs/FANTASY_TRANSFER_RULES.md");

const checks=[];
function must(name,condition){checks.push({name,ok:Boolean(condition)});if(!condition)throw new Error(`MP-10 regression failed: ${name}`)}

must("fast xFP horizon engine retained",route.includes('get_fantasy_xfp_round_horizons_admin_v2'));
must("authoritative transfer status retained",route.includes('get_fantasy_transfer_status_v1'));
must("old hard cap of two removed",!route.includes('Math.min(2,Number(statusRow.transfers_remaining'));
must("0/2/4 transfer limit normalized from RPC",route.includes('normalizeOptimizerTransferLimit(statusRow.transfers_remaining)'));
must("server reads locked-player constraint",route.includes('parseLockedPlayerIds(request.nextUrl.searchParams.get("locked"))'));
must("invalid locked player rejected",route.includes('Låste spillere må tilhøre ditt nåværende Fantasy-lag'));
must("locked players excluded from outgoing pool",route.includes('current.filter(p=>!lockedIds.has(p.id))'));
must("authoritative availability table retained",route.includes('fantasy_player_availability'));
must("blocked availability gate retained",route.includes('isOptimizerEligibleAvailability(availabilityStatus)'));
must("balanced strategy retained",route.includes('balanced:'));
must("conservative strategy retained",route.includes('conservative:'));
must("offensive strategy retained",route.includes('offensive:'));
must("UI sends locked IDs",page.includes('qs.set("locked",Array.from(nextLocked).join(","))'));
must("UI exposes lock action",page.includes('🔓 Lås')&&page.includes('🔒 Låst'));
must("UI shows new team value",page.includes('ny lagverdi'));
must("UI explains no bank",page.includes('Ingen byttebank'));
must("UI explains no points hit",page.includes('ingen poengtrekk'));
must("helper allows Bytteboost four-transfer maximum",helper.includes('Math.min(4'));
must("final rules document says normal max two",/2 permanente bytter/i.test(transferRules));
must("final rules document says Bytteboost four",/Bytteboost[\s\S]{0,200}4/i.test(transferRules));
must("final rules document blocks permanent Event Week transfers",/Rik Onkel[\s\S]{0,250}Fattig Onkel/i.test(transferRules)&&/sperr|blokker|ikke.*permanent/i.test(transferRules));

console.log(`MP-10 optimizer regression: ${checks.length}/${checks.length} checks passed.`);
