import fs from "node:fs";

const page=fs.readFileSync("app/fantasy/stats/page.tsx","utf8");
const nav=fs.readFileSync("app/fantasy/FantasyNav.tsx","utf8");
const sectionNav=fs.readFileSync("app/fantasy/PointsSectionNav.tsx","utf8");
const checks=[
 [page.includes('get_my_fantasy_stats_dashboard_v1'),"stats dashboard must use personal authenticated stats RPC"],
 [page.includes('Poeng per runde')&&page.includes('Kumulative poeng')&&page.includes('Sammenlagtrank')&&page.includes('Lagverdi over tid'),"required history charts must exist"],
 [page.includes('Keeper')&&page.includes('Back')&&page.includes('Forward'),"position points breakdown must exist"],
 [page.includes('C/VC-bonus')&&page.includes('Bytter'),"captain/vice and transfer metrics must exist"],
 [page.includes('Median')&&page.includes('Verste runde')&&page.includes('Rundeseire')&&page.includes('Topp 10 %-runder')&&page.includes('Kapteinsandel')&&page.includes('Beste Bonus/Event Week'),"safe MP-07.9 season insights must exist"],
 [page.includes('Transfergevinst/-tap')&&page.includes('xFP-over/underprestasjon')&&page.includes('availability-tapte poeng'),"unsafe historical estimates must be explicitly withheld"],
 [!page.includes('fantasy_user_team_players'),"stats page must not reconstruct history from current team players"],
 [!nav.includes('label:"Min statistikk"'),"personal stats must not clutter the primary Fantasy navigation"],
 [nav.includes('href:"/fantasy/my-rounds",label:"Poeng"')&&nav.includes('pathname==="/fantasy/stats"'),"Poeng must remain the primary section and stay active for stats"],
 [sectionNav.includes('Rundehistorikk')&&sectionNav.includes('Min statistikk')&&sectionNav.includes('/fantasy/my-rounds')&&sectionNav.includes('/fantasy/stats'),"points section must expose round history and personal stats as internal tabs"]
];
let failed=0;
for(const[ok,msg]of checks){console.log(`${ok?'PASS':'FAIL'} ${msg}`);if(!ok)failed++}
if(failed)process.exit(1);
