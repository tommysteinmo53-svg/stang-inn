type RosterRow = { name:string; team:string; position?:string|null; [key:string]:any };

const TEAM_PAGES: Record<string,string> = {
  "Frisk Asker": "https://www.eliteprospects.com/team/175/frisk-asker",
  "Lillehammer": "https://www.eliteprospects.com/team/176/lillehammer",
  "Narvik": "https://www.eliteprospects.com/team/8229/narvik-hockey",
  "Nidaros": "https://www.eliteprospects.com/team/12510/nidaros-hockey",
  "Ringerike": "https://www.eliteprospects.com/team/5384/ringerike",
  "Sparta": "https://www.eliteprospects.com/team/621/sparta-sarpsborg/2026-2027",
  "Stavanger": "https://www.eliteprospects.com/team/845/stavanger-oilers",
  "Stjernen": "https://www.eliteprospects.com/team/180/stjernen-hockey",
  "Storhamar": "https://www.eliteprospects.com/team/181/storhamar",
  "Vålerenga": "https://www.eliteprospects.com/team/183/valerenga",
};

const NAME_ALIASES: Record<string,string[]> = {
  "charles francis callaghan": ["charlie callaghan"],
  "carl michael william magnusson": ["william magnusson"],
  "anton karl yngve hjalmarsson": ["anton hjalmarsson"],
  "isak anders samuel pantzare": ["isak pantzare"],
  "joona samuli partanen": ["joona partanen"],
  "albin erik eriksson": ["albin eriksson"],
  "johan martin ceder": ["johan ceder"],
  "rasmus sebastian koskinen": ["rasmus koskinen"],
  "erik felix bjørge granath": ["felix granath"],
  "michael hopland haga": ["michael haga"],
  "patrick stig hylland ulriksen": ["patrick ulriksen"],
  "thomas valkvæ hollevik olsen": ["thomas valkvæ olsen"],
  "emil andreas lund nyhus": ["emil nyhus"],
  "martin andre ellingsen": ["martin ellingsen"],
  "ulf thomas albin mörck": ["albin mörck"],
  "wilhelm tor øivind gullhav": ["wilhelm gullhav"],
  "max henrik hagesveen andresen": ["max hagesveen andresen"],
  "andreas benjamin heier": ["andreas heier"],
  "emil august krabberød buskoven": ["emil buskoven"],
  "kasper laban byrkjeland": ["laban byrkjeland"],
  "theodor mateus steen-gulbrandsen": ["theodor steen-gulbrandsen"],
  "christian johansen kåsastul": ["christian kåsastul"],
  "mattias alfer nørstebø": ["mattias nørstebø"],
  "steinar andreas klavestad": ["andreas klavestad"],
  "christian rogne bull": ["christian bull"],
  "david andreas aas-larsen": ["david aas-larsen"],
  "jacob ludwig berglund": ["jacob berglund"],
  "kenneth pappalardo gulbrandsen": ["kenneth pappalardo gulbrandsen"],
  "tommy andreas hjelm": ["andreas hjelm"],
  "martin nikolai røymark": ["martin røymark"],
  "jørgen kvarud karterud": ["jørgen karterud"],
  "mikkel seiergren christiansen": ["mikkel christiansen"],
};

function norm(v:any){
  return String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
}
function canonTeam(v:string){
  const s=norm(v);
  if(s.includes("storhamar"))return"Storhamar";
  if(s.includes("stavanger")||s.includes("oilers"))return"Stavanger";
  if(s.includes("valerenga"))return"Vålerenga";
  if(s.includes("frisk"))return"Frisk Asker";
  if(s.includes("sparta"))return"Sparta";
  if(s.includes("narvik"))return"Narvik";
  if(s.includes("stjernen"))return"Stjernen";
  if(s.includes("lillehammer"))return"Lillehammer";
  if(s.includes("ringerike"))return"Ringerike";
  if(s.includes("nidaros"))return"Nidaros";
  return String(v||"").trim();
}
function fantasyPos(raw:string):"G"|"D"|"C"|"W"|null{
  const p=String(raw||"").toUpperCase().replace(/\s/g,"");
  const primary=p.split(/[\/,-]/)[0];
  if(primary==="G")return"G";
  if(primary==="D")return"D";
  if(primary==="C")return"C";
  if(["LW","RW","W","F"].includes(primary))return"W";
  if(p.includes("GOAL"))return"G";
  if(p.includes("DEF"))return"D";
  if(p.includes("CENTER"))return"C";
  if(p.includes("FORWARD")||p.includes("WING"))return"W";
  return null;
}
function decodeHtml(s:string){
  return s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/&oslash;/gi,"ø").replace(/&Oslash;/g,"Ø").replace(/&aelig;/gi,"æ").replace(/&aring;/gi,"å");
}
function parseRoster(html:string){
  const found:{name:string;position:"G"|"D"|"C"|"W";rawPosition:string}[]=[];
  const seen=new Set<string>();
  const patterns=[
    />([^<>\n]{2,90}?)\s*\((G|D|C|LW|RW|W|F|C\/W|W\/C|C\/LW|C\/RW|LW\/C|RW\/C|LW\/RW|RW\/LW)\)<\/a>/gi,
    />([^<>\n]{2,90}?)\s*\((G|D|C|LW|RW|W|F|C\/W|W\/C|C\/LW|C\/RW|LW\/C|RW\/C|LW\/RW|RW\/LW)\)</gi,
  ];
  for(const re of patterns){
    let m:RegExpExecArray|null;
    while((m=re.exec(html))){
      const name=decodeHtml(m[1]).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
      const position=fantasyPos(m[2]);
      if(!position||name.length<3)continue;
      const key=`${norm(name)}|${position}`;
      if(seen.has(key))continue;
      seen.add(key); found.push({name,position,rawPosition:m[2]});
    }
  }
  return found;
}
function matchScore(fullName:string,candidate:string){
  const a=norm(fullName),b=norm(candidate);
  if(!a||!b)return 0;
  if(a===b)return 1000;
  const aliases=NAME_ALIASES[a]||[];
  if(aliases.some(x=>norm(x)===b))return 990;
  const A=a.split(" "),B=b.split(" "),lastA=A[A.length-1],lastB=B[B.length-1];
  if(lastA!==lastB)return 0;
  const firstA=A[0],firstB=B[0];
  if(firstA===firstB)return 900-Math.abs(A.length-B.length)*10;
  if(firstA.slice(0,4)===firstB.slice(0,4))return 820-Math.abs(A.length-B.length)*10;
  let overlap=0;const setB=new Set(B);for(const t of A)if(setB.has(t))overlap++;
  return overlap>=2?500+overlap*20:0;
}

export async function enrichMissingPositions<T extends RosterRow>(rows:T[]){
  const out=rows.map(r=>({...r})) as T[];
  const missing=out.filter(r=>!r.position);
  const diagnostics:any[]=[];
  let enriched=0;
  for(const team of [...new Set(missing.map(r=>canonTeam(r.team)))]){
    const url=TEAM_PAGES[team];
    if(!url)continue;
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),6500);
      const res=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"Mozilla/5.0 (compatible; StangInn/1.0; +fantasy-position-enrichment)"}});
      clearTimeout(timer);
      const html=await res.text();
      const roster=res.ok?parseRoster(html):[];
      let teamEnriched=0;
      for(const row of out.filter(r=>!r.position&&canonTeam(r.team)===team)){
        let best:any=null,bestScore=0;
        for(const cand of roster){const s=matchScore(row.name,cand.name);if(s>bestScore){bestScore=s;best=cand}}
        if(best&&bestScore>=800){
          (row as any).position=best.position;
          (row as any).positionSource="eliteprospects";
          (row as any).positionSourceDetail=best.rawPosition;
          (row as any).eliteProspectsMatchedName=best.name;
          enriched++;teamEnriched++;
        }
      }
      diagnostics.push({team,url,status:res.status,rosterParsed:roster.length,enriched:teamEnriched});
    }catch(e:any){diagnostics.push({team,url,error:e?.name==="AbortError"?"timeout":e?.message||String(e),rosterParsed:0,enriched:0})}
  }
  return {rows:out,enriched,remaining:out.filter(r=>!r.position).length,diagnostics};
}
