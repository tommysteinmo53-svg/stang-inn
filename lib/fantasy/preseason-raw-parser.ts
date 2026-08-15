type FantasyPlayer={id:string;name:string;team:string;position:string|null};
type ParsedPlayer={playerId:string;playerName:string;team:string;position:string|null;didPlay:boolean;goals:number;assists:number;saves:number;goalsAgainst:number;minutesPlayed:number;knownFields:string[];evidence:string[]};

function ascii(v:unknown){return String(v??"").trim().toLowerCase().replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function compact(v:unknown){return ascii(v).replace(/[^a-z0-9]+/g,"")}
function teamKey(v:unknown){const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"stavanger";if(s.includes("valerenga")||s.includes("vaalerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return compact(v)}
function nameForms(name:string){const clean=name.trim(),parts=clean.split(/\s+/).filter(Boolean);const forms=[clean];if(parts.length>=2){forms.push(`${parts[parts.length-1]}, ${parts.slice(0,-1).join(" ")}`);forms.push(`${parts[parts.length-1]} ${parts[0]}`)}return Array.from(new Set(forms.map(compact).filter(Boolean)))}
function containsName(text:string,name:string){const c=compact(text);return nameForms(name).some(f=>f.length>=5&&c.includes(f))}
function lineEvidence(lines:string[],name:string){return lines.filter(l=>containsName(l,name)).slice(0,8)}
function scoreFromRaw(raw:string){const hits=[...raw.matchAll(/(?:^|\s)(\d{1,2})\s*[-–]\s*(\d{1,2})(?=\s|\(|$)/gm)].map(m=>({home:Number(m[1]),away:Number(m[2])}));if(!hits.length)return null;return hits.reduce((best,x)=>(x.home+x.away)>(best.home+best.away)?x:best,hits[0])}
function goalieFraction(line:string){const m=line.match(/\((\d{1,3})\s*\/\s*(\d{1,3})\)/);if(!m)return null;const saves=Number(m[1]),shots=Number(m[2]);if(shots<saves)return null;return{saves,goalsAgainst:shots-saves}}

export function parseExternalPreseasonRaw(args:{rawData:string;homeTeam:string;awayTeam:string;players:FantasyPlayer[]}){
 const raw=String(args.rawData||"");const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const homeKey=teamKey(args.homeTeam),awayKey=teamKey(args.awayTeam);
 const eligible=args.players.filter(p=>{const k=teamKey(p.team);return k===homeKey||k===awayKey});
 const parsed=new Map<string,ParsedPlayer>();
 for(const p of eligible){const evidence=lineEvidence(lines,p.name);if(!evidence.length)continue;parsed.set(p.id,{playerId:p.id,playerName:p.name,team:p.team,position:p.position,didPlay:true,goals:0,assists:0,saves:0,goalsAgainst:0,minutesPlayed:0,knownFields:["didPlay"],evidence});}

 // Event rows: a score change followed by scorer and optional assists. Only current-roster EHL players are credited.
 const goalLines=lines.filter(l=>/\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(l)&&/(EQ|PP|SH|ENG|PS|GWG|\d{1,2}:\d{2})/i.test(l));
 for(const line of goalLines){const found=eligible.filter(p=>containsName(line,p.name));if(!found.length)continue;const scorer=parsed.get(found[0].id);if(scorer){scorer.goals++;if(!scorer.knownFields.includes("goals"))scorer.knownFields.push("goals");scorer.evidence=Array.from(new Set([...scorer.evidence,line])).slice(0,10)}for(const a of found.slice(1,3)){const row=parsed.get(a.id);if(row){row.assists++;if(!row.knownFields.includes("assists"))row.knownFields.push("assists");row.evidence=Array.from(new Set([...row.evidence,line])).slice(0,10)}}}

 // Goalie summary such as "Tyler Parks 95,83% (23/24)".
 for(const p of eligible.filter(p=>p.position==="G")){for(const line of lines.filter(l=>containsName(l,p.name))){const f=goalieFraction(line);if(!f)continue;const row=parsed.get(p.id);if(!row)continue;row.saves=Math.max(row.saves,f.saves);row.goalsAgainst=Math.max(row.goalsAgainst,f.goalsAgainst);for(const k of ["saves","goalsAgainst"])if(!row.knownFields.includes(k))row.knownFields.push(k);row.evidence=Array.from(new Set([...row.evidence,line])).slice(0,10)}}

 const score=scoreFromRaw(raw);const rows=[...parsed.values()].sort((a,b)=>a.team.localeCompare(b.team,"nb")||a.playerName.localeCompare(b.playerName,"nb"));
 return{score,rows,matchedPlayers:rows.length,goalEvents:goalLines.length,confidence:rows.length?"review":"none" as const,warnings:[...(rows.length?[]:["Ingen nåværende EHL-spillere ble sikkert funnet i råteksten."]),...(goalLines.length?[]:["Ingen sikre målhendelseslinjer ble funnet; lineup kan fortsatt importeres."])]};
}
