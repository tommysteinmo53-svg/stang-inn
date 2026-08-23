"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import {canonicalFantasyTeam} from "../../../lib/fantasy/team-normalization";
import "./event-team.css";

type Pos="C"|"W"|"D"|"G";
type Player={id:string;name:string;team:string;position:Pos;price:number};
type EventType="rich_uncle"|"poor_uncle";
type EventRow={event_week_id:string;event_type:EventType;event_budget:number;round_id:string;round_no:number;round_name:string;deadline_at:string;is_open:boolean;event_team_id:string|null;event_team_name:string|null;team_cost:number;player_id:string|null;line_no:number|null;is_captain:boolean|null;is_vice_captain:boolean|null};
type Game={fantasy_round_no:number;starts_at:string|null;home_team:string;away_team:string};
type Fixture={opponent:string;venue:"H"|"B"};
const SEASON="2026/27";
const group=(p:Player)=>p.position==="D"?"D":p.position==="G"?"G":"F";
const eventLabel=(t:EventType)=>t==="rich_uncle"?"Rik Onkel":"Fattig Onkel";

function defaultLine1(ids:string[],players:Player[]){
 const chosen=ids.map(id=>players.find(p=>p.id===id)).filter(Boolean) as Player[];const out:string[]=[];
 for(const [g,n] of [["F",3],["D",2],["G",1]] as const)out.push(...chosen.filter(p=>group(p)===g).slice(0,n).map(p=>p.id));
 return out;
}
function lineValid(ids:string[],chosen:Player[]){const p=ids.map(id=>chosen.find(x=>x.id===id)).filter(Boolean) as Player[];return ids.length===6&&new Set(ids).size===6&&p.filter(x=>group(x)==="F").length===3&&p.filter(x=>x.position==="D").length===2&&p.filter(x=>x.position==="G").length===1}

export default function EventTeamPage(){
 const[players,setPlayers]=useState<Player[]>([]),[events,setEvents]=useState<EventRow[]>([]),[activeType,setActiveType]=useState<EventType|null>(null),[selected,setSelected]=useState<string[]>([]),[line1,setLine1]=useState<string[]>([]);
 const[captain,setCaptain]=useState<string|null>(null),[vice,setVice]=useState<string|null>(null),[name,setName]=useState("Eventlag"),[msg,setMsg]=useState("Laster Event Weeks …"),[busy,setBusy]=useState(false),[q,setQ]=useState(""),[pos,setPos]=useState<"ALL"|"F"|"D"|"G">("ALL"),[games,setGames]=useState<Game[]>([]),[maxClub,setMaxClub]=useState(3);

 async function load(){try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data:session}=await s.auth.getSession();if(!session.session)throw new Error("Du må være logget inn");
  const[{data:p,error:pe},{data:prices,error:pre},{data:rr},{data:schedule,error:se},{data:rich,error:re},{data:poor,error:poe}]=await Promise.all([
   s.from("fantasy_players").select("id,name,team,position").in("position",["C","W","D","G"]).order("name"),
   s.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON),
   s.from("fantasy_season_rules").select("max_players_per_club").eq("season",SEASON).maybeSingle(),
   s.rpc("get_fantasy_round_schedule_v1",{p_season:SEASON}),
   s.rpc("get_my_fantasy_event_week_v1",{p_season:SEASON,p_event_type:"rich_uncle"}),
   s.rpc("get_my_fantasy_event_week_v1",{p_season:SEASON,p_event_type:"poor_uncle"})
  ]);if(pe)throw pe;if(pre)throw pre;if(se)throw se;if(re)throw re;if(poe)throw poe;
  const priceMap=new Map((prices||[]).map((x:any)=>[String(x.player_id),Number(x.price)]));const pool=((p||[]) as any[]).filter(x=>priceMap.has(String(x.id))).map(x=>({...x,price:priceMap.get(String(x.id))!})) as Player[];setPlayers(pool);setGames(((schedule||[]) as any[]).map(x=>({...x,fantasy_round_no:Number(x.fantasy_round_no)})) as Game[]);if(rr?.max_players_per_club)setMaxClub(Number(rr.max_players_per_club));
  const all=[...((rich||[]) as EventRow[]),...((poor||[]) as EventRow[])].map(x=>({...x,event_budget:Number(x.event_budget),round_no:Number(x.round_no),team_cost:Number(x.team_cost||0),line_no:x.line_no==null?null:Number(x.line_no)}));setEvents(all);
  const types=Array.from(new Set(all.map(x=>x.event_type)));const initial=(activeType&&types.includes(activeType)?activeType:types.find(t=>all.some(x=>x.event_type===t&&x.is_open))||types[0]||null) as EventType|null;setActiveType(initial);if(initial)hydrate(initial,all,pool);else setMsg("Ingen publisert Event Week akkurat nå.");
 }catch(e:any){setMsg(`Kunne ikke laste Event Week: ${e.message||e}`)}}
 useEffect(()=>{load()},[]);

 function hydrate(t:EventType,rows=events,pool=players){const er=rows.filter(x=>x.event_type===t);const ids=er.map(x=>x.player_id).filter(Boolean) as string[];setSelected(ids);const stored=er.filter(x=>x.player_id&&x.line_no===1).map(x=>x.player_id!) ;setLine1(lineValid(stored,ids.map(id=>pool.find(p=>p.id===id)).filter(Boolean) as Player[])?stored:defaultLine1(ids,pool));setCaptain(er.find(x=>x.is_captain)?.player_id||null);setVice(er.find(x=>x.is_vice_captain)?.player_id||null);setName(er[0]?.event_team_name||`${eventLabel(t)}-lag`);setMsg(er[0]?.is_open?`${eventLabel(t)} er åpen for redigering`:`${eventLabel(t)} er låst`)}
 const current=events.filter(x=>x.event_type===activeType);const meta=current[0]||null;const budget=meta?.event_budget??0;const chosen=useMemo(()=>selected.map(id=>players.find(p=>p.id===id)).filter(Boolean) as Player[],[selected,players]);const total=chosen.reduce((s,p)=>s+p.price,0);const left=budget-total;
 const counts={F:chosen.filter(p=>group(p)==="F").length,D:chosen.filter(p=>p.position==="D").length,G:chosen.filter(p=>p.position==="G").length};const clubCounts=useMemo(()=>{const m=new Map<string,number>();chosen.forEach(p=>m.set(p.team,(m.get(p.team)||0)+1));return m},[chosen]);const clubOverflow=[...clubCounts.values()].some(n=>n>maxClub);const valid=selected.length===12&&counts.F===6&&counts.D===4&&counts.G===2&&left>=0&&!clubOverflow&&!!captain&&!!vice&&captain!==vice&&lineValid(line1,chosen);
 const visible=players.filter(p=>(pos==="ALL"||(pos==="F"?group(p)==="F":p.position===pos))&&(!q||`${p.name} ${p.team}`.toLowerCase().includes(q.toLowerCase())));
 const fixtures=useMemo(()=>{const m=new Map<string,Fixture[]>();if(!meta)return m;for(const g of games.filter(g=>g.fantasy_round_no===meta.round_no)){const h=canonicalFantasyTeam(g.home_team),a=canonicalFantasyTeam(g.away_team);m.set(h,[...(m.get(h)||[]),{opponent:a,venue:"H"}]);m.set(a,[...(m.get(a)||[]),{opponent:h,venue:"B"}])}return m},[games,meta?.round_no]);
 const fixture=(team:string)=>{if(!meta)return "";const f=fixtures.get(canonicalFantasyTeam(team))||[];return f.length?f.map(x=>`${x.venue}: ${x.opponent}`).join(" · "):"Ingen kamp"};
 function toggle(p:Player){if(!meta?.is_open)return;if(selected.includes(p.id)){const next=selected.filter(x=>x!==p.id);setSelected(next);setLine1(defaultLine1(next,players));if(captain===p.id)setCaptain(null);if(vice===p.id)setVice(null);return}if(selected.length>=12)return setMsg("Eventlaget har allerede 12 spillere");if(group(p)==="F"&&counts.F>=6)return setMsg("Du har allerede 6 forwards");if(p.position==="D"&&counts.D>=4)return setMsg("Du har allerede 4 backer");if(p.position==="G"&&counts.G>=2)return setMsg("Du har allerede 2 keepere");if((clubCounts.get(p.team)||0)>=maxClub)return setMsg(`Maks ${maxClub} spillere fra ${p.team}`);if(total+p.price>budget)return setMsg(`Budsjettet overskrides med ${(total+p.price-budget).toFixed(1)}m`);const next=[...selected,p.id];setSelected(next);setLine1(defaultLine1(next,players));}
 function switchLine(id:string){const p=players.find(x=>x.id===id);if(!p)return;const inL1=line1.includes(id);const candidate=chosen.find(x=>group(x)===group(p)&&line1.includes(x.id)!==inL1);if(!candidate)return setMsg("Ingen spiller i motsatt rekke med samme posisjonsgruppe");setLine1(inL1?[...line1.filter(x=>x!==id),candidate.id]:[...line1.filter(x=>x!==candidate.id),id]);}
 async function save(){if(!meta?.is_open||!activeType||!valid)return;setBusy(true);try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{error}=await s.rpc("save_fantasy_event_team_v1",{p_season:SEASON,p_event_type:activeType,p_name:name,p_player_ids:selected,p_line1_player_ids:line1,p_captain:captain,p_vice_captain:vice});if(error)throw error;setMsg(`${eventLabel(activeType)}-laget er lagret ✓`);await load()}catch(e:any){setMsg(`Lagring stoppet: ${e.message||e}`)}finally{setBusy(false)}}

 if(!meta)return <main className="event-shell"><div className="event-empty"><h1>Event Weeks</h1><p>{msg}</p><p>Det permanente fantasy-laget ditt påvirkes ikke.</p></div></main>;
 return <main className="event-shell"><section className="event-hero"><div><p className="fantasy-kicker">STANG INN · EVENT WEEK</p><h1>{eventLabel(meta.event_type)}</h1><p>Bygg et midlertidig lag for runde {meta.round_no}. Det permanente 100m-laget ditt endres ikke.</p></div><span className="event-badge">{meta.is_open?"ÅPEN":"LÅST"}</span></section>
  {Array.from(new Set(events.map(x=>x.event_type))).length>1&&<div className="event-tabs">{Array.from(new Set(events.map(x=>x.event_type))).map(t=><button key={t} className={activeType===t?"active":""} onClick={()=>{setActiveType(t);hydrate(t)}}>{eventLabel(t)}</button>)}</div>}
  <div className="event-warning"><strong>Viktig:</strong> Dette er et separat eventlag. Bytter her bruker ikke vanlige transfers og lagres ikke i ditt permanente fantasy-lag.</div>
  <section className="event-info"><article><span>Budsjett</span><strong>{budget.toFixed(0)}m</strong></article><article><span>Brukt</span><strong>{total.toFixed(1)}m</strong></article><article><span>Igjen</span><strong>{left.toFixed(1)}m</strong></article><article><span>Deadline</span><strong>{new Date(meta.deadline_at).toLocaleString("nb-NO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</strong></article></section>
  <section className="event-grid"><div className="event-panel"><h2>Spillerpool</h2><div className="event-filters"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Søk spiller eller klubb"/><select value={pos} onChange={e=>setPos(e.target.value as any)}><option value="ALL">Alle</option><option value="F">Forwards</option><option value="D">Backer</option><option value="G">Keepere</option></select></div><div className="event-pool">{visible.map(p=><div key={p.id} className="event-pool-row"><strong>{group(p)}</strong><div className="event-player-meta"><b>{p.name}</b><small>{p.team} · {p.position}</small><small className="event-fixture">Runde {meta.round_no} · {fixture(p.team)}</small></div><span>{p.price.toFixed(1)}m</span><button disabled={!meta.is_open} onClick={()=>toggle(p)}>{selected.includes(p.id)?"Fjern":"Legg til"}</button></div>)}</div></div>
   <div className="event-panel"><h2>Eventlaget</h2><input className="event-name" value={name} onChange={e=>setName(e.target.value)} disabled={!meta.is_open}/>{([1,2] as const).map(n=><div className="event-line" key={n}><h3>Rekke {n}</h3>{chosen.filter(p=>n===1?line1.includes(p.id):!line1.includes(p.id)).map(p=><div className="event-roster-row" key={p.id}><strong>{group(p)}</strong><div className="event-player-meta"><b>{p.name}</b><small>{p.team} · {p.price.toFixed(1)}m</small></div><button className="event-line-select" onClick={()=>switchLine(p.id)} disabled={!meta.is_open}>Bytt rekke</button><div className="event-role"><button className={captain===p.id?"active":""} onClick={()=>{setCaptain(p.id);if(vice===p.id)setVice(null)}} disabled={!meta.is_open}>C</button><button className={vice===p.id?"active":""} onClick={()=>{setVice(p.id);if(captain===p.id)setCaptain(null)}} disabled={!meta.is_open}>VC</button></div></div>)}</div>)}<div className="event-actions"><span className="event-msg">{msg}</span><button className="primary" disabled={!valid||busy||!meta.is_open} onClick={save}>{busy?"Lagrer …":"Lagre eventlag"}</button></div></div>
  </section></main>;
}
