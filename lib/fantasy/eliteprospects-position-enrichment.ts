import { POSITION_CACHE_2026 } from "./position-cache-2026";

type RosterRow = { name:string; team:string; position?:string|null; [key:string]:any };

function norm(v:any){
  return String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
}

const CACHE = new Map(Object.entries(POSITION_CACHE_2026).map(([name,value])=>[norm(name),value]));

export async function enrichMissingPositions<T extends RosterRow>(rows:T[]){
  const out=rows.map(r=>({...r})) as T[];
  const beforeMissing=out.filter(r=>!r.position).length;
  const matches:any[]=[];
  let enriched=0;

  for(const row of out){
    if(row.position)continue;
    const hit=CACHE.get(norm(row.name));
    if(!hit)continue;
    (row as any).position=hit.position;
    (row as any).positionSource="eliteprospects";
    (row as any).positionSourceDetail=hit.sourceNote||"Verified EliteProspects position · local 2026/27 cache";
    enriched++;
    matches.push({name:row.name,team:row.team,position:hit.position,source:hit.source,detail:hit.sourceNote||null});
  }

  const remainingRows=out.filter(r=>!r.position);
  const diagnostics=[{
    mode:"local-cache",
    source:"Versioned EliteProspects position cache",
    liveFetchEnabled:false,
    reason:"EliteProspects returns HTTP 403 to Vercel, so production uses a verified local cache instead of live scraping.",
    cacheEntries:CACHE.size,
    beforeMissing,
    enriched,
    remaining:remainingRows.length,
    matches,
    unresolved:remainingRows.map(r=>({name:r.name,team:r.team})),
  }];

  return {rows:out,enriched,remaining:remainingRows.length,diagnostics};
}
