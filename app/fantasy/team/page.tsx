"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";

type Pos="C"|"W"|"D"|"G";
type Player={id:string;name:string;team:string;position:Pos;price:number};
type Rules={max_players_per_club:number;captain_multiplier:number;vice_captain_enabled:boolean};
type TransferStatus={effective_round_no:number;deadline_at:string;max_transfers_per_round:number;transfers_used:number;transfers_remaining:number;team_cost:number};
const SEASON="2026/27",BUDGET=100;
const group=(p:Player)=>p.position==="D"?"D":p.position==="G"?"G":"F";

function buildLine1(ids:string[],players:Player[],preferred:string[]=[]){
 const chosen=ids.map(id=>players.find(p=>p.id===id)).filter(Boolean) as Player[];
 const out:string[]=[];
 for(const [g,n] of [["F",3],["D",2],["G",1]] as const){
  const candidates=chosen.filter(p=>group(p)===g);
  const pref=candidates.filter(p=>preferred.includes(p.id));
  out.push(...[...pref,...candidates.filter(p=>!pref.includes(p))].slice(0,n).map(p=>p.id));
 }
 return out;
}
function validLine1(ids:string[],chosen:Player[]){
 const p=ids.map(id=>chosen.find(x=>x.id===id)).filter(Boolean) as Player[];
 return ids.length===6&&new Set(ids).size===6&&p.filter(x=>group(x)==="F").length===3&&p.filter(x=>x.position==="D").length===2&&p.filter(x=>x.position==="G").length===1;
}

export default function FantasyTeamPage(){
 const[players,setPlayers]=useState<Player[]>([]),[selected,setSelected]=useState<string[]>([]),[initialRoster,setInitialRoster]=useState<string[]>([]),[line1,setLine1]=useState<string[]>([]);
 const[teamName,setTeamName]=useState("Mitt lag"),[msg,setMsg]=useState("Laster spillerpool …"),[busy,setBusy]=useState(false),[filter,setFilter]=useState<"ALL"|"F"|Pos>("ALL"),[q,setQ]=useState("");
 const[rules,setRules]=useState<Rules>({max_players_per_club:3,captain_multiplier:2,vice_captain_enabled:true});
 const[captain,setCaptain]=useState<string|null>(null),[viceCaptain,setViceCaptain]=useState<string|null>(null),[teamId,setTeamId]=useState<string|null>(null);
 const[seasonStarted,setSeasonStarted]=useState(false),[transferStatus,setTransferStatus]=useState<TransferStatus|null>(null);

 async function refreshTransferStatus(){
  const s=getSupabaseBrowserClient();if(!s||!teamId)return;
  const{data,error}=await s.rpc("get_fantasy_transfer_status_v1",{p_season:SEASON});
  if(!error&&data?.[0])setTransferStatus({...data[0],effective_round_no:Number(data[0].effective_round_no),max_transfers_per_round:Number(data[0].max_transfers_per_round),transfers_used:Number(data[0].transfers_used),transfers_remaining:Number(data[0].transfers_remaining),team_cost:Number(data[0].team_cost)});
 }

 useEffect(()=>{(async()=>{try{
  const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data:session}=await s.auth.getSession();if(!session.session)throw new Error("Du må være logget inn");
  const[{data:p,error},{data:prices,error:pe},{data:r},{data:firstRound}]=await Promise.all([
   s.from("fantasy_players").select("id,name,team,position").in("position",["C","W","D","G"]).order("name"),
   s.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON),
   s.from("fantasy_season_rules").select("max_players_per_club,captain_multiplier,vice_captain_enabled").eq("season",SEASON).maybeSingle(),
   s.from("fantasy_rounds").select("deadline_at").eq("season",SEASON).lt("round_no",9000).order("deadline_at",{ascending:true}).limit(1).maybeSingle()
  ]);
  if(error)throw error;if(pe)throw pe;
  const priceMap=new Map((prices||[]).map((x:any)=>[x.player_id,Number(x.price)]));
  const pool=(p||[]).filter((x:any)=>priceMap.has(x.id)).map((x:any)=>({...x,price:priceMap.get(x.id)!})) as Player[];
  setPlayers(pool);if(r)setRules({max_players_per_club:Number(r.max_players_per_club),captain_multiplier:Number(r.captain_multiplier),vice_captain_enabled:Boolean(r.vice_captain_enabled)});
  setSeasonStarted(Boolean(firstRound?.deadline_at&&Date.now()>=new Date(firstRound.deadline_at).getTime()));
  const{data:t}=await s.from("fantasy_user_teams").select("id,name").eq("season",SEASON).maybeSingle();
  if(t){setTeamId(t.id);setTeamName(t.name||"Mitt lag");const{data:tp}=await s.from("fantasy_user_team_players").select("player_id,is_captain,is_vice_captain,line_no").eq("team_id",t.id);
   const roster=(tp||[]).map((x:any)=>x.player_id);setSelected(roster);setInitialRoster(roster);setCaptain((tp||[]).find((x:any)=>x.is_captain)?.player_id||null);setViceCaptain((tp||[]).find((x:any)=>x.is_vice_captain)?.player_id||null);
   const stored=(tp||[]).filter((x:any)=>Number(x.line_no)===1).map((x:any)=>x.player_id);setLine1(validLine1(stored,roster.map(id=>pool.find(x=>x.id===id)).filter(Boolean) as Player[])?stored:buildLine1(roster,pool,stored));
   const{data:ts}=await s.rpc("get_fantasy_transfer_status_v1",{p_season:SEASON});if(ts?.[0])setTransferStatus({...ts[0],effective_round_no:Number(ts[0].effective_round_no),max_transfers_per_round:Number(ts[0].max_transfers_per_round),transfers_used:Number(ts[0].transfers_used),transfers_remaining:Number(ts[0].transfers_remaining),team_cost:Number(ts[0].team_cost)});
  }
  setMsg(`${pool.length} spillere med låste 2026/27-priser klare`);
 }catch(e:any){setMsg(`Kunne ikke laste lagbygger: ${e.message||e}`)}})()},[]);

 const chosen=useMemo(()=>selected.map(id=>players.find(p=>p.id===id)).filter(Boolean) as Player[],[selected,players]);
 const total=chosen.reduce((s,p)=>s+p.price,0),left=BUDGET-total;
 const counts=useMemo(()=>({F:chosen.filter(p=>group(p)==="F").length,C:chosen.filter(p=>p.position==="C").length,W:chosen.filter(p=>p.position==="W").length,D:chosen.filter(p=>p.position==="D").length,G:chosen.filter(p=>p.position==="G").length}),[chosen]);
 const clubCounts=useMemo(()=>{const m=new Map<string,number>();for(const p of chosen)m.set(p.team,(m.get(p.team)||0)+1);return m},[chosen]);
 const clubOverflow=[...clubCounts.entries()].find(([,n])=>n>rules.max_players_per_club);
 const lineupValid=validLine1(line1,chosen),valid=selected.length===12&&left>=0&&counts.F===6&&counts.D===4&&counts.G===2&&!clubOverflow&&!!captain&&!!viceCaptain&&captain!==viceCaptain&&lineupValid;
 const pendingTransfers=seasonStarted&&teamId?selected.filter(id=>!initialRoster.includes(id)).length:0;
 const transferLimit=transferStatus?.max_transfers_per_round??2,used=transferStatus?.transfers_used??0;
 const visible=players.filter(p=>(filter==="ALL"||(filter==="F"?group(p)==="F":p.position===filter))&&(!q||`${p.name} ${p.team}`.toLowerCase().includes(q.toLowerCase())));

 function toggle(p:Player){
  if(selected.includes(p.id)){const next=selected.filter(x=>x!==p.id);setSelected(next);setLine1(buildLine1(next,players,line1));if(captain===p.id)setCaptain(null);if(viceCaptain===p.id)setViceCaptain(null);return}
  if(selected.length>=12){setMsg("Laget har allerede 12 spillere");return}
  if(seasonStarted&&teamId&&!initialRoster.includes(p.id)&&used+pendingTransfers>=transferLimit){setMsg(`Du har nådd grensen på ${transferLimit} bytter i denne runden`);return}
  if(group(p)==="F"&&counts.F>=6){setMsg("Du har allerede 6 forwards");return}if(p.position==="D"&&counts.D>=4){setMsg("Du har allerede 4 backer");return}if(p.position==="G"&&counts.G>=2){setMsg("Du har allerede 2 keepere");return}
  if((clubCounts.get(p.team)||0)>=rules.max_players_per_club){setMsg(`Maks ${rules.max_players_per_club} spillere fra ${p.team}`);return}if(total+p.price>BUDGET){setMsg(`Budsjettet overskrides med ${(total+p.price-BUDGET).toFixed(1)}m`);return}
  const next=[...selected,p.id];setSelected(next);setLine1(buildLine1(next,players,line1));setMsg(`${p.name} lagt til`);
 }
 function setC(id:string){setCaptain(id);if(viceCaptain===id)setViceCaptain(null)}function setVC(id:string){setViceCaptain(id);if(captain===id)setCaptain(null)}
 function swapLine(id:string,target:string){if(!target)return;const next=line1.includes(id)?[...line1.filter(x=>x!==id),target]:[...line1.filter(x=>x!==target),id];setLine1(next);setMsg("Rekke endret · dette bruker ikke et bytte")}

 async function save(){if(!valid)return;setBusy(true);try{
  const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");let savedTeamId=teamId;
  if(seasonStarted&&teamId){const{error}=await s.rpc("apply_fantasy_transfers_v1",{p_season:SEASON,p_name:teamName,p_player_ids:selected,p_captain:captain,p_vice_captain:viceCaptain});if(error)throw error;}
  else{const{data,error}=await s.rpc("save_fantasy_team_v3",{p_season:SEASON,p_name:teamName,p_player_ids:selected,p_captain:captain,p_vice_captain:viceCaptain});if(error)throw error;savedTeamId=data;setTeamId(data);}
  const{error:le}=await s.rpc("set_fantasy_lineup_v1",{p_season:SEASON,p_line1_player_ids:line1});if(le)throw le;
  setInitialRoster([...selected]);if(savedTeamId)setTeamId(savedTeamId);
  const{data:ts}=await s.rpc("get_fantasy_transfer_status_v1",{p_season:SEASON});if(ts?.[0])setTransferStatus({...ts[0],effective_round_no:Number(ts[0].effective_round_no),max_transfers_per_round:Number(ts[0].max_transfers_per_round),transfers_used:Number(ts[0].transfers_used),transfers_remaining:Number(ts[0].transfers_remaining),team_cost:Number(ts[0].team_cost)});
  setMsg(seasonStarted?"Endringer lagret ✓":"Lag og rekker lagret ✓");
 }catch(e:any){setMsg(`Lagring stoppet: ${e.message||e}`)}finally{setBusy(false)}}

 const linePlayers=(n:1|2)=>chosen.filter(p=>n===1?line1.includes(p.id):!line1.includes(p.id));
 const renderPlayer=(p:Player,n:1|2)=>{const alternatives=linePlayers(n===1?2:1).filter(x=>group(x)===group(p));return <div key={p.id} style={{display:"flex",gap:6,alignItems:"center",marginTop:6,flexWrap:"wrap"}}><button onClick={()=>toggle(p)} style={{flex:"1 1 260px",textAlign:"left"}}>{p.name} · {p.team} · {p.position} · {p.price.toFixed(1)}m ✕</button><button onClick={()=>setC(p.id)} disabled={captain===p.id}>{captain===p.id?"👑 C":"C"}</button><button onClick={()=>setVC(p.id)} disabled={viceCaptain===p.id}>{viceCaptain===p.id?"⭐ VC":"VC"}</button><select value="" onChange={e=>swapLine(p.id,e.target.value)}><option value="">Bytt rekke …</option>{alternatives.map(x=><option key={x.id} value={x.id}>med {x.name}</option>)}</select></div>};

 return <main className="fantasy-shell"><section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>{seasonStarted?"Gjør bytter":"Bygg laget ditt"}</h1><p className="fantasy-lead">12 spillere · 6F · 4D · 2G · maks 100,0m · maks {rules.max_players_per_club} fra samme klubb · faste priser hele sesongen.</p></div></section>
 <section className="fantasy-metrics"><article><span>Spillere</span><strong>{selected.length}/12</strong></article><article><span>Brukt</span><strong>{total.toFixed(1)}m</strong></article><article><span>Igjen</span><strong>{left.toFixed(1)}m</strong></article><article><span>{seasonStarted?"Bytter":"Status"}</span><strong>{seasonStarted?`${used+pendingTransfers}/${transferLimit}`:(valid?"✓ Klar":"Bygg lag")}</strong></article></section>
 {seasonStarted&&transferStatus&&<section className="fantasy-card" style={{marginBottom:16}}><p className="eyebrow">RUNDE {transferStatus.effective_round_no}</p><h2>{transferStatus.transfers_remaining} av {transferStatus.max_transfers_per_round} bytter igjen</h2><p className="card-copy">Ventende endringer: {pendingTransfers}. Rekketøy og C/VC er gratis. Deadline: {new Date(transferStatus.deadline_at).toLocaleString("nb-NO")}.</p></section>}
 <section className="fantasy-grid"><div className="fantasy-card fantasy-main-card"><p className="eyebrow">DITT LAG</p><h2>{teamName}</h2><input value={teamName} onChange={e=>setTeamName(e.target.value)} style={{padding:10,borderRadius:10,width:"100%",maxWidth:320,marginBottom:12}}/>
 <p className="card-copy">Velg kaptein og visekaptein. Hver rekke skal ha 3F · 2D · 1G. Bytt spillere mellom rekkene med menyen ved spilleren.</p>
 {([1,2] as const).map(n=><div key={n} style={{marginBottom:18}}><h3>{n}. rekke</h3>{linePlayers(n).map(p=>renderPlayer(p,n))}<p className="card-copy">{linePlayers(n).filter(p=>group(p)==="F").length}/3 F · {linePlayers(n).filter(p=>p.position==="D").length}/2 D · {linePlayers(n).filter(p=>p.position==="G").length}/1 G</p></div>)}
 {clubOverflow&&<p className="card-copy"><strong>⛔ For mange spillere fra {clubOverflow[0]}: {clubOverflow[1]}/{rules.max_players_per_club}</strong></p>}{!lineupValid&&selected.length===12&&<p className="card-copy"><strong>⛔ Hver rekke må være 3F · 2D · 1G.</strong></p>}
 <button onClick={save} disabled={!valid||busy}>{busy?"Lagrer …":seasonStarted?"Lagre bytter og oppstilling":"Lagre lag"}</button><p className="card-copy"><strong>{msg}</strong></p></div>
 <div className="fantasy-card"><p className="eyebrow">SPILLERPOOL</p><h2>Velg spillere</h2><p className="card-copy">Prisene under er de låste 2026/27-prisene.</p><input placeholder="Søk spiller eller lag" value={q} onChange={e=>setQ(e.target.value)} style={{padding:10,borderRadius:10,width:"100%",marginBottom:8}}/><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{(["ALL","F","C","W","D","G"] as const).map(x=><button key={x} onClick={()=>setFilter(x)} disabled={filter===x}>{x}</button>)}</div><div style={{maxHeight:650,overflowY:"auto"}}>{visible.map(p=>{const on=selected.includes(p.id),clubFull=(clubCounts.get(p.team)||0)>=rules.max_players_per_club;return <button key={p.id} onClick={()=>toggle(p)} style={{display:"block",width:"100%",textAlign:"left",marginBottom:6,opacity:on?.55:clubFull?.6:1}} disabled={on}>{p.name}<br/><small>{p.team} · {p.position} · {p.price.toFixed(1)}m{clubFull&&!on?` · klubbgrense ${rules.max_players_per_club}/${rules.max_players_per_club}`:""}</small></button>})}</div></div></section></main>
}
