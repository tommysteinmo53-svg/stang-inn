import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = "https://sf34-terminlister-prod-app.azurewebsites.net";
const TOURNAMENT_ID = process.env.HOCKEYLIVE_TOURNAMENT_ID || "448981";

type AnyRow = Record<string, any>;

function first(row:any,...keys:string[]) {
  for (const k of keys) if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== "") return row[k];
  return null;
}
function textValue(value:any):string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    const nested=first(value,"name","fullName","teamName","shortName","displayName","label","value","text");
    if (nested !== null && nested !== value) return textValue(nested);
  }
  return "";
}
function pos(v:any) {
  const s=textValue(v).toLowerCase();
  if (s==="g"||s.includes("goal")||s.includes("målvakt")) return "G";
  if (s==="d"||s.includes("back")||s.includes("def")) return "D";
  if (s==="c"||s.includes("center")) return "C";
  if (s==="w"||s.includes("wing")||s.includes("ving")||s==="lw"||s==="rw"||s.includes("forward")) return "W";
  return null;
}
function normName(row:any):string {
  const full=first(row,"fullName","name","playerName","personName","displayName");
  if(full && typeof full !== "object") return String(full).trim();
  const person=first(row,"person","player","member");
  if(person && typeof person === "object") { const nested=normName(person); if(nested) return nested; }
  const f=textValue(first(row,"firstName","firstname","givenName"));
  const l=textValue(first(row,"lastName","lastname","familyName","surname"));
  return [f,l].filter(Boolean).join(" ").trim();
}
function ownTeam(row:any){
  const directText=textValue(first(row,"teamName","teamShortName","orgName","clubName","tournamentTeamName"));
  if(directText) return directText;
  return textValue(first(row,"team","club","organization","org","tournamentTeam"));
}
function looksLikePlayer(row:any){
  if(!row || typeof row !== "object" || Array.isArray(row)) return false;
  const hasId=first(row,"personId","PersonId","playerId","memberId") !== null;
  const hasNamedField=first(row,"playerName","personName","fullName","firstName","firstname","lastName","lastname") !== null;
  const typed=String(first(row,"entityType","type","memberType")||"").toLowerCase();
  return hasId || hasNamedField || typed.includes("player");
}
function extractPlayers(payload:any){
  const found:{row:AnyRow; inheritedTeam:string}[]=[];
  const seen=new Set<object>();
  function walk(value:any,inheritedTeam=""){
    if(!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if(Array.isArray(value)) { for(const item of value) walk(item,inheritedTeam); return; }
    const row=value as AnyRow;
    const teamHere=ownTeam(row)||inheritedTeam;
    if(looksLikePlayer(row) && normName(row)) found.push({row,inheritedTeam:teamHere});
    for(const [key,item] of Object.entries(row)){
      if(!item || typeof item !== "object") continue;
      const childTeam=/team|club|org/i.test(key) && !looksLikePlayer(item) ? textValue(item)||teamHere : teamHere;
      walk(item,childTeam);
    }
  }
  walk(payload,"");
  return found;
}

const candidates = [
  `${ROOT}/ta/TournamentPlayers/?tournamentId=${encodeURIComponent(TOURNAMENT_ID)}`,
  `${ROOT}/ta/TournamentPlayers?tournamentId=${encodeURIComponent(TOURNAMENT_ID)}`,
  `${ROOT}/icehockey/TournamentPlayers/${encodeURIComponent(TOURNAMENT_ID)}`,
];

export async function GET(){
  try{
    const attempts:any[]=[];
    for(const url of candidates){
      try{
        const r=await fetch(url,{cache:"no-store",headers:{Accept:"application/json,text/plain,*/*","User-Agent":"StangInn/1.0 roster-import"}});
        const text=await r.text();
        let payload:any=null; try{payload=JSON.parse(text)}catch{}
        const source=payload==null?[]:extractPlayers(payload);
        const rows=source.map(({row:x,inheritedTeam}:any)=>({
          personId:first(x,"personId","PersonId","playerId","memberId","id") ?? first(x?.person||{},"personId","id"),
          name:normName(x), team:ownTeam(x)||inheritedTeam,
          position:pos(first(x,"position","playerPosition","positionName","pos","role")),
          shirtNo:first(x,"shirtNo","jerseyNo","number","shirtNumber"), raw:x,
        })).filter((x:any)=>x.name&&x.team);
        const unique=[...new Map(rows.map((x:any)=>[String(x.personId||`${x.team}|${x.name}`),x])).values()];
        attempts.push({url,status:r.status,ok:r.ok,payloadType:Array.isArray(payload)?"array":typeof payload,topLevelKeys:payload&&typeof payload==="object"&&!Array.isArray(payload)?Object.keys(payload).slice(0,30):[],arrayLength:Array.isArray(payload)?payload.length:null,sourceRows:source.length,players:unique.length,bodyPreview:text.slice(0,700)});
        if(r.ok && unique.length) return NextResponse.json({ok:true,tournamentId:TOURNAMENT_ID,sourceUrl:url,sourceRows:source.length,players:unique.length,rows:unique,attempts});
      }catch(e:any){attempts.push({url,error:e?.message||String(e)})}
    }
    return NextResponse.json({ok:true,tournamentId:TOURNAMENT_ID,sourceRows:0,players:0,rows:[],diagnostic:{message:"Ingen av de kjente HockeyLive-rosterendepunktene ga spillere.",attempts}});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Ukjent feil"},{status:500})}
}
