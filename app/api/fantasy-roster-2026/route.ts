import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = "https://sf34-terminlister-prod-app.azurewebsites.net";
const TOURNAMENT_ID = process.env.HOCKEYLIVE_TOURNAMENT_ID || "448981";

function rowsFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["data","items","players","members","result","results"]) if (Array.isArray(payload[key])) return payload[key];
  return [];
}

function first(row:any,...keys:string[]) { for (const k of keys) if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== "") return row[k]; return null; }
function pos(v:any) {
  const s=String(v??"").toLowerCase();
  if (s==="g"||s.includes("goal")) return "G";
  if (s==="d"||s.includes("back")||s.includes("def")) return "D";
  if (s==="c"||s.includes("center")) return "C";
  if (s==="w"||s.includes("wing")||s.includes("ving")||s==="lw"||s==="rw") return "W";
  return null;
}
function normName(row:any){
  const full=first(row,"fullName","name","playerName","personName"); if(full) return String(full).trim();
  const f=first(row,"firstName","firstname"), l=first(row,"lastName","lastname"); return [f,l].filter(Boolean).join(" ").trim();
}
function team(row:any){return String(first(row,"teamName","teamShortName","orgName","clubName","team","tournamentTeamName")||"").trim()}

export async function GET(){
  try{
    const url=`${ROOT}/icehockey/TournamentPlayers/${encodeURIComponent(TOURNAMENT_ID)}`;
    const r=await fetch(url,{cache:"no-store",headers:{Accept:"application/json,text/plain,*/*","User-Agent":"StangInn/1.0 roster-import"}});
    const text=await r.text();
    if(!r.ok) return NextResponse.json({ok:false,error:`HockeyLive svarte ${r.status}`,body:text.slice(0,300),url},{status:502});
    let payload:any; try{payload=JSON.parse(text)}catch{return NextResponse.json({ok:false,error:"HockeyLive svarte ikke med JSON",body:text.slice(0,300),url},{status:502})}
    const source=rowsFrom(payload);
    const rows=source.map((x:any)=>({
      personId:first(x,"personId","PersonId","playerId","id"),
      name:normName(x),
      team:team(x),
      position:pos(first(x,"position","playerPosition","positionName","pos")),
      shirtNo:first(x,"shirtNo","jerseyNo","number"),
      raw:x,
    })).filter((x:any)=>x.name&&x.team);
    const unique=[...new Map(rows.map((x:any)=>[String(x.personId||`${x.team}|${x.name}`),x])).values()];
    return NextResponse.json({ok:true,tournamentId:TOURNAMENT_ID,sourceRows:source.length,players:unique.length,rows:unique});
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||"Ukjent feil"},{status:500})}
}
