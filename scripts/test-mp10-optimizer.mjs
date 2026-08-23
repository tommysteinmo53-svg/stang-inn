import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const route=read("app/api/admin/fantasy/transfer-optimizer/route.ts");
const publicRoute=read("app/api/fantasy/transfer-optimizer/route.ts");
const page=read("app/fantasy/admin-analysis/optimizer/page.tsx");
const publicPage=read("app/fantasy/optimizer/page.tsx");
const nav=read("app/fantasy/FantasyNav.tsx");
const helper=read("lib/fantasy/optimizer-transfer-policy.ts");
const xfpSql=read("supabase/mp10-user-optimizer-xfp-v1.sql");
const economySql=read("supabase/mp10-user-optimizer-economy-v1.sql");
const transferRules=read("docs/FANTASY_TRANSFER_RULES.md");

const checks=[];
function must(name,condition){checks.push({name,ok:Boolean(condition)});if(!condition)throw new Error(`MP-10 regression failed: ${name}`)}

must("authenticated user xFP horizon engine used",route.includes('get_fantasy_xfp_round_horizons_v1'));
must("authenticated user economy RPC used",route.includes('get_fantasy_economy_v1'));
must("optimizer verifies authenticated user",route.includes('sb.auth.getUser()'));
must("admin-only gate removed from user optimizer handler",!route.includes('requireFantasyAdmin'));
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
must("admin UI still sends locked IDs",page.includes('qs.set("locked",Array.from(nextLocked).join(","))'));
must("public UI sends locked IDs",publicPage.includes('qs.set("locked",Array.from(nextLocked).join(","))'));
must("public UI exposes lock action",publicPage.includes('🔓 Lås')&&publicPage.includes('🔒 Låst'));
must("public UI shows OUT and IN",publicPage.includes('>UT<')&&publicPage.includes('>INN<'));
must("public UI shows new team value",publicPage.includes('ny lagverdi'));
must("public UI explains no bank",publicPage.includes('Ingen byttebank'));
must("public UI explains no points hit",publicPage.includes('ingen poengtrekk'));
must("public UI calls public optimizer API",publicPage.includes('/api/fantasy/transfer-optimizer'));
must("public optimizer API alias exists",publicRoute.includes('../../admin/fantasy/transfer-optimizer/route'));
must("fantasy navigation exposes optimizer",nav.includes('/fantasy/optimizer')&&nav.includes('Optimalisator'));
must("user xFP RPC requires authentication",xfpSql.includes("if auth.uid() is null then raise exception 'Not authenticated'"));
must("user xFP RPC does not grant anon",xfpSql.includes('revoke all on function public.get_fantasy_xfp_round_horizons_v1(text) from anon'));
must("user xFP RPC is read-only definition",!/(insert\s+into|update\s+\w+\s+set|delete\s+from)/i.test(xfpSql));
must("user economy RPC requires authentication",economySql.includes("if auth.uid() is null then raise exception 'Not authenticated'"));
must("user economy RPC does not grant anon",economySql.includes('revoke all on function public.get_fantasy_economy_v1(text) from anon'));
must("helper allows Bytteboost four-transfer maximum",helper.includes('Math.min(4'));
must("final rules document says normal max two",/2 permanente bytter/i.test(transferRules));
must("final rules document says Bytteboost four",/Bytteboost[\s\S]{0,200}4/i.test(transferRules));
must("final rules document blocks permanent Event Week transfers",/Rik Onkel[\s\S]{0,250}Fattig Onkel/i.test(transferRules)&&/sperr|blokker|ikke.*permanent/i.test(transferRules));

console.log(`MP-10 optimizer regression: ${checks.length}/${checks.length} checks passed.`);
