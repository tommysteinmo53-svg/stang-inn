import fs from "node:fs";

const source=fs.readFileSync("app/fantasy/team/page.tsx","utf8");
const checks=[
 [source.includes('select("id,name,team,position,active,on_current_roster,available_for_purchase")'),"team builder must load authoritative purchase flags"],
 [source.includes("purchasable:Boolean(x.active&&x.on_current_roster&&x.available_for_purchase)"),"purchasable must require active + current roster + server purchase flag"],
 [source.includes("const marketPlayers=useMemo(()=>players.filter(p=>p.purchasable)"),"market must be restricted to purchasable players"],
 [source.includes("unavailableSelected.length===0"),"team validity must reject a selected unavailable player"],
 [source.includes("if(!p.purchasable){setMsg"),"client add action must reject unavailable players"],
 [source.includes("Må erstattes:"),"existing teams must explain which unavailable player must be replaced"],
 [!source.includes('select("id,name,team,position").in("position"'),"price-only legacy market query must not return"],
];

const failed=checks.filter(([ok])=>!ok);
for(const[ok,message]of checks)console.log(`${ok?"PASS":"FAIL"}: ${message}`);
if(failed.length){
 console.error(`MP-14 purchase consistency regression failed: ${failed.length} check(s)`);
 process.exit(1);
}
console.log("MP-14 purchase consistency regression passed.");
