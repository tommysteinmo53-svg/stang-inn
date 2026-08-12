import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = "https://sf34-terminlister-prod-app.azurewebsites.net";
const NIF_ROOT = "https://data.nif.no";
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
    const nested=first(value,"name","fullName","teamName","shortName","displayName","label","value","text","orgName");
    if (nested !== null && nested !== value) return textValue(nested);
  }
  return "";
}
function rowsFrom(payload:any):AnyRow[] {
  if (Array.isArray(payload)) return payload.filter((x:any)=>x&&typeof x==="object") as AnyRow[];
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["data","items","rows","teams","members","players","results","result"]) {
    if (Array.isArray(payload[key])) return payload[key] as AnyRow[];
  }
  return [];
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
  const directText=textValue(first(row,"teamName","teamShortName","orgName","clubName","tournamentTeamName","teamOverriddenName"));
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
function extractPlayers(payload:any,inheritedTeam=""){
  const found:{row:AnyRow; inheritedTeam:string}[]=[];
  const seen=new Set<object>();
  function walk(value:any,team=""){
    if(!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if(Array.isArray(value)) { for(const item of value) walk(item,team); return; }
    const row=value as AnyRow;
    const teamHere=ownTeam(row)||team;
    if(looksLikePlayer(row) && normName(row)) found.push({row,inheritedTeam:teamHere});
    for(const [key,item] of Object.entries(row)){
      if(!item || typeof item !== "object") continue;
      const childTeam=/team|club|org/i.test(key) && !looksLikePlayer(item) ? textValue(item)||teamHere : teamHere;
      walk(item,childTeam);
    }
  }
  walk(payload,inheritedTeam);
  return found;
}
function normalizePlayers(source:{row:AnyRow;inheritedTeam:string}[]){
  const rows=source.map(({row:x,inheritedTeam})=>({
    personId:first(x,"personId","PersonId","playerId","memberId","id") ?? first(x?.person||{},"personId","id"),
    name:normName(x),
    team:ownTeam(x)||inheritedTeam,
    position:pos(first(x,"position","playerPosition","positionName","pos","role","memberTypeName")),
    shirtNo:first(x,"shirtNo","jerseyNo","number","shirtNumber"),
    raw:x,
  })).filter((x:any)=>x.name&&x.team);
  return [...new Map(rows.map((x:any)=>[String(x.personId||`${x.team}|${x.name}`),x])).values()];
}
async function fetchAttempt(url:string,attempts:any[]){
  try{
    const r=await fetch(url,{cache:"no-store",headers:{Accept:"application/json,text/plain,*/*","User-Agent":"StangInn/1.0 roster-import"}});
    const text=await r.text();
    let payload:any=null; try{payload=JSON.parse(text)}catch{}
    attempts.push({url,status:r.status,ok:r.ok,payloadType:Array.isArray(payload)?"array":typeof payload,topLevelKeys:payload&&typeof payload==="object"&&!Array.isArray(payload)?Object.keys(payload).slice(0,30):[],arrayLength:Array.isArray(payload)?payload.length:null,bodyPreview:text.slice(0,700)});
    return {r,text,payload};
  }catch(e:any){attempts.push({url,error:e?.message||String(e)});return null}
}

const directCandidates = [
  `${ROOT}/api/v1/icehockey/TournamentPlayers/${encodeURIComponent(TOURNAMENT_ID)}`,
  `${NIF_ROOT}/api/v1/icehockey/TournamentPlayers/${encodeURIComponent(TOURNAMENT_ID)}`,
  `${ROOT}/icehockey/TournamentPlayers/${encodeURIComponent(TOURNAMENT_ID)}`,
  `${ROOT}/ta/TournamentPlayers/?tournamentId=${encodeURIComponent(TOURNAMENT_ID)}`,
  `${ROOT}/ta/TournamentPlayers?tournamentId=${encodeURIComponent(TOURNAMENT_ID)}`,
];

export async function GET(){
  try{
    const attempts:any[]=[];

    for(const url of directCandidates){
      const a=await fetchAttempt(url,attempts); if(!a) continue;
      const source=a.payload==null?[]:extractPlayers(a.payload);
      const unique=normalizePlayers(source);
      const last=attempts[attempts.length-1]; last.sourceRows=source.length; last.players=unique.length;
      if(a.r.ok && unique.length) return NextResponse.json({ok:true,tournamentId:TOURNAMENT_ID,source:"tournament-players",sourceUrl:url,sourceRows:source.length,players:unique.length,rows:unique,attempts});
    }

    // TournamentPlayers er ikke offentlig for 2026/27. Bygg i stedet spillerpoolen fra
    // de offentlige TA-kildene: TournamentTeams -> TeamMembers per org/team.
    const teamUrls=[
      `${ROOT}/ta/TournamentTeams/?tournamentId=${encodeURIComponent(TOURNAMENT_ID)}`,
      `${ROOT}/ta/TournamentTeams?tournamentId=${encodeURIComponent(TOURNAMENT_ID)}`,
    ];
    let teamRows:AnyRow[]=[];
    for(const url of teamUrls){
      const a=await fetchAttempt(url,attempts); if(!a||!a.r.ok) continue;
      teamRows=rowsFrom(a.payload);
      attempts[attempts.length-1].teamRows=teamRows.length;
      if(teamRows.length) break;
    }

    const combined:{row:AnyRow;inheritedTeam:string}[]=[];
    const teamDiagnostics:any[]=[];
    for(const t of teamRows){
      const teamName=textValue(first(t,"teamName","tournamentTeamName","teamOverriddenName","orgName","name","clubName","team"));
      const orgId=first(t,"orgId","organizationId","clubId","teamOrgId","teamId") ?? first(t?.team||{},"orgId","id") ?? first(t?.organization||{},"id","orgId");
      if(!orgId){teamDiagnostics.push({team:teamName||"?",error:"Mangler orgId/teamId",keys:Object.keys(t).slice(0,30)});continue}
      const memberUrls=[
        `${ROOT}/ta/TeamMembers/${encodeURIComponent(String(orgId))}`,
        `${ROOT}/ta/TeamMembers/?orgId=${encodeURIComponent(String(orgId))}`,
        `${ROOT}/ta/TeamMembers?orgId=${encodeURIComponent(String(orgId))}`,
      ];
      let got=0;
      for(const url of memberUrls){
        const a=await fetchAttempt(url,attempts); if(!a||!a.r.ok) continue;
        const source=extractPlayers(a.payload,teamName);
        if(source.length){combined.push(...source);got=source.length;break}
        const raw=rowsFrom(a.payload);
        for(const row of raw) if(normName(row)) combined.push({row,inheritedTeam:teamName});
        if(raw.length){got=raw.length;break}
      }
      teamDiagnostics.push({team:teamName||"?",orgId:String(orgId),members:got});
    }
    const unique=normalizePlayers(combined);
    if(unique.length) return NextResponse.json({ok:true,tournamentId:TOURNAMENT_ID,source:"tournament-teams+team-members",sourceRows:combined.length,players:unique.length,rows:unique,teamDiagnostics,attempts});

    return NextResponse.json({ok:true,tournamentId:TOURNAMENT_ID,sourceRows:0,players:0,rows:[],diagnostic:{message:"Ingen offentlig rosterkilde ga spillere. NIF TournamentPlayers krever partnerautentisering; offentlig fallback TournamentTeams → TeamMembers ga heller ingen spillere.",teamRows:teamRows.length,teamDiagnostics,attempts}});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Ukjent feil"},{status:500})}
}
