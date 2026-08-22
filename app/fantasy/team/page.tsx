"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";
import "./fixtures.css";

type Pos="C"|"W"|"D"|"G";
type Player={id:string;name:string;team:string;position:Pos;price:number};
type Rules={max_players_per_club:number;captain_multiplier:number;vice_captain_enabled:boolean};
type TransferStatus={effective_round_no:number;deadline_at:string;max_transfers_per_round:number;transfers_used:number;transfers_remaining:number;team_cost:number};
type Round={id:string;round_no:number;deadline_at:string};
type Game={game_id:string;fantasy_round_id:string;fantasy_round_no:number;starts_at:string|null;home_team:string;away_team:string};
type Fixture={opponent:string;venue:"H"|"B";starts_at:string|null};
const SEASON="2026/27",BUDGET=100;
const group=(p:Player)=>p.position==="D"?"D":p.position==="G"?"G":"F";
const lineupOrder=(a:Player,b:Player)=>({G:0,D:1,F:2}[group(a)]-({G:0,D:1,F:2}[group(b)]));

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
 const[teamName,setTeamName]=useState("Mitt lag"),[msg,setMsg]=useState("Laster spillerpool …"),[busy,setBusy]=useState(false),[filter,setFilter]=useState<"ALL"|"F"|Pos>("ALL"),[clubFilter,setClubFilter]=useState("ALL"),[q,setQ]=useState("");
 const[rules,setRules]=useState<Rules>({max_players_per_club:3,captain_multiplier:2,vice_captain_enabled:true});
 const[captain,setCaptain]=useState<string|null>(null),[viceCaptain,setViceCaptain]=useState<string|null>(null),[teamId,setTeamId]=useState<string|null>(null);
 const[seasonStarted,setSeasonStarted]=useState(false),[transferStatus,setTransferStatus]=useState<TransferStatus|null>(null);
 const[rounds,setRounds]=useState<Round[]>([]),[roundGames,setRoundGames]=useState<Game[]>([]);

 useEffect(()=>{(async()=>{try{
  const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data:session}=await s.auth.getSession();if(!session.session)throw new Error("Du må være logget inn");
  const[{data:p,error},{data:prices,error:pe},{data:r},{data:roundRows,error:re},{data:schedule,error:se}]=await Promise.all([
   s.from("fantasy_players").select("id,name,team,position").in("position",["C","W","D","G"]).order("name"),
   s.from("fantasy_player_season_prices").select("player_id,price").eq("season",SEASON),
   s.from("fantasy_season_rules").select("max_players_per_club,captain_multiplier,vice_captain_enabled").eq("season",SEASON).maybeSingle(),
   s.from("fantasy_rounds").select("id,round_no,deadline_at").eq("season",SEASON).lt("round_no",9000).order("deadline_at",{ascending:true}),
   s.rpc("get_fantasy_round_schedule_v1",{p_season:SEASON})
  ]);
  if(error)throw error;if(pe)throw pe;if(re)throw re;if(se)throw se;
  const priceMap=new Map((prices||[]).map((x:any)=>[x.player_id,Number(x.price)]));
  const pool=(p||[]).filter((x:any)=>priceMap.has(x.id)).map((x:any)=>({...x,price:priceMap.get(x.id)!})) as Player[];
  const loadedRounds=((roundRows||[]) as any[]).map(x=>({id:String(x.id),round_no:Number(x.round_no),deadline_at:String(x.deadline_at)})) as Round[];
  setPlayers(pool);setRounds(loadedRounds);setRoundGames(((schedule||[]) as any[]).map(x=>({...x,fantasy_round_no:Number(x.fantasy_round_no)})) as Game[]);
  if(r)setRules({max_players_per_club:Number(r.max_players_per_club),captain_multiplier:Number(r.captain_multiplier),vice_captain_enabled:Boolean(r.vice_captain_enabled)});
  const firstRound=loadedRounds[0];setSeasonStarted(Boolean(firstRound?.deadline_at&&Date.now()>=new Date(firstRound.deadline_at).getTime()));
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
 const clubs=useMemo(()=>Array.from(new Set(players.map(p=>p.team))).sort((a,b)=>a.localeCompare(b,"nb")),[players]);
 const clubOverflow=[...clubCounts.entries()].find(([,n])=>n>rules.max_players_per_club);
 const lineupValid=validLine1(line1,chosen),valid=selected.length===12&&left>=0&&counts.F===6&&counts.D===4&&counts.G===2&&!clubOverflow&&!!captain&&!!viceCaptain&&captain!==viceCaptain&&lineupValid;
 const pendingTransfers=seasonStarted&&teamId?selected.filter(id=>!initialRoster.includes(id)).length:0;
 const transferLimit=transferStatus?.max_transfers_per_round??2,used=transferStatus?.transfers_used??0;
 const visible=players.filter(p=>(filter==="ALL"||(filter==="F"?group(p)==="F":p.position===filter))&&(clubFilter==="ALL"||p.team===clubFilter)&&(!q||`${p.name} ${p.team}`.toLowerCase().includes(q.toLowerCase())));
 const targetRoundNo=transferStatus?.effective_round_no??rounds.find(r=>new Date(r.deadline_at).getTime()>Date.now())?.round_no??rounds.at(-1)?.round_no??null;
 const fixturesByTeam=useMemo(()=>{const m=new Map<string,Fixture[]>();if(targetRoundNo==null)return m;const games=roundGames.filter(g=>g.fantasy_round_no===targetRoundNo).sort((a,b)=>(a.starts_at||"").localeCompare(b.starts_at||""));for(const g of games){m.set(g.home_team,[...(m.get(g.home_team)||[]),{opponent:g.away_team,venue:"H",starts_at:g.starts_at}]);m.set(g.away_team,[...(m.get(g.away_team)||[]),{opponent:g.home_team,venue:"B",starts_at:g.starts_at}])}return m},[roundGames,targetRoundNo]);
 const fixtureLabel=(team:string)=>{if(targetRoundNo==null)return "Gameweek: ikke tilgjengelig";const fixtures=fixturesByTeam.get(team)||[];return fixtures.length?`Runde ${targetRoundNo} · ${fixtures.map(f=>`${f.venue}: ${f.opponent}`).join(" · ")}`:`Runde ${targetRoundNo} · Ingen kamp`};

 function toggle(p:Player){
  if(selected.includes(p.id)){const next=selected.filter(x=>x!==p.id);setSelected(next);setLine1(buildLine1(next,players,line1));if(captain===p.id)setCaptain(null);if(viceCaptain===p.id)setViceCaptain(null);return}
  if(selected.length>=12){setMsg("Laget har allerede 12 spillere");return}
  if(seasonStarted&&teamId&&!initialRoster.includes(p.id)&&used+pendingTransfers>=transferLimit){setMsg(`Du har nådd grensen på ${transferLimit} bytter i denne runden`);return}
  if(group(p)==="F"&&counts.F>=6){setMsg("Du har allerede 6 forwards");return}if(p.position==="D"&&counts.D>=4){setMsg("Du har allerede 4 backer");return}if(p.position==="G"&&counts.G>=2){setMsg("Du har allerede 2 keepere");return}
  if((clubCounts.get(p.team)||0)>=rules.max_players_per_club){setMsg(`Maks ${rules.max_players_per_club} spillere fra ${p.team}`);return}if(total+p.price>BUDGET){setMsg(`Budsjettet overskrides med ${(total+p.price-BUDGET).toFixed(1)}m`);return}
  const next=[...selected,p.id];setSelected(next);setLine1(buildLine1(next,players,line1));setMsg(`${p.name} lagt til`);
 }
 function setC(id:string){setCaptain(id);if(viceCaptain===id)setViceCaptain(null)}
 function setVC(id:string){setViceCaptain(id);if(captain===id)setCaptain(null)}
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

 const linePlayers=(n:1|2)=>chosen.filter(p=>n===1?line1.includes(p.id):!line1.includes(p.id)).sort(lineupOrder);
 const renderPlayer=(p:Player,n:1|2)=>{const alternatives=linePlayers(n===1?2:1).filter(x=>group(x)===group(p));const noGame=targetRoundNo!=null&&(fixturesByTeam.get(p.team)||[]).length===0;return <div key={p.id} className="team-player-row">
  <span className={`team-pos team-pos-${group(p).toLowerCase()}`}>{group(p)}</span>
  <div className="team-player-main"><strong onClick={()=>window.location.assign(`/fantasy/players/${p.id}`)} title="Åpne spillerprofil" style={{cursor:"pointer",textDecoration:"underline",textUnderlineOffset:3}}>{p.name}</strong><small>{p.team} · {p.position}</small><small className={`team-player-fixtures ${noGame?"no-game":""}`}>{fixtureLabel(p.team)}</small></div>
  <span className="team-price">{p.price.toFixed(1)}m</span>
  <div className="team-badges"><button className={captain===p.id?"active":""} onClick={()=>setC(p.id)} title="Kaptein">C</button><button className={viceCaptain===p.id?"active":""} onClick={()=>setVC(p.id)} title="Visekaptein">VC</button></div>
  <select className="team-line-select" value="" onChange={e=>swapLine(p.id,e.target.value)}><option value="">Bytt rekke</option>{alternatives.map(x=><option key={x.id} value={x.id}>med {x.name}</option>)}</select>
  <button className="team-remove" onClick={()=>toggle(p)} title="Fjern spiller">×</button>
 </div>};

 return <main className="fantasy-shell team-builder-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Mitt lag</h1><p>Bygg laget innenfor budsjettet. Maks 2 spillerbytter per fantasy-runde.</p></div></section>
  <section className="team-metric-grid">
   <article><span>Spillere</span><strong>{selected.length}/12</strong></article>
   <article><span>Budsjett brukt</span><strong>{total.toFixed(1)}m</strong></article>
   <article><span>Igjen</span><strong>{left.toFixed(1)}m</strong></article>
   <article><span>Bytter i runde</span><strong>{seasonStarted?`${used+pendingTransfers}/${transferLimit}`:"0/2"}</strong><small>{seasonStarted?`${Math.max(0,transferLimit-used-pendingTransfers)} igjen`:"Gratis før sesongstart"}</small></article>
   <article><span>Status</span><strong>{valid?"✓ Klar":"Ikke klar"}</strong></article>
  </section>

  <section className="team-builder-grid">
   <div className="team-panel team-lineup-panel">
    <div className="team-panel-top"><div><p className="eyebrow">OPPSTILLING</p><h2>{teamName}</h2></div><input className="team-name-input" value={teamName} onChange={e=>setTeamName(e.target.value)}/></div>
    {seasonStarted&&transferStatus&&<div className="team-round-strip"><strong>Runde {transferStatus.effective_round_no}</strong><span>{transferStatus.transfers_remaining} av {transferStatus.max_transfers_per_round} bytter igjen</span><span>Frist {new Date(transferStatus.deadline_at).toLocaleString("nb-NO")}</span></div>}
    {!seasonStarted&&targetRoundNo!=null&&<div className="team-round-strip"><strong>Bygger for runde {targetRoundNo}</strong><span>Motstanderne under hver spiller følger denne fantasy-runden</span></div>}
    {([1,2] as const).map(n=><div key={n} className="team-line-card"><div className="team-line-head"><h3>{n}. rekke</h3><span>1G · 2D · 3F</span></div>{linePlayers(n).map(p=>renderPlayer(p,n))}</div>)}
    {clubOverflow&&<p className="team-error">For mange spillere fra {clubOverflow[0]}: {clubOverflow[1]}/{rules.max_players_per_club}</p>}
    {!lineupValid&&selected.length===12&&<p className="team-error">Hver rekke må være 1G · 2D · 3F.</p>}
    <button className="team-save" onClick={save} disabled={!valid||busy}>{busy?"Lagrer …":seasonStarted?"Lagre bytter og oppstilling":"Lagre lag"}</button>
    <p className="team-save-note">Rekkeendringer og kaptein/visekaptein bruker ikke bytter.</p>
    <p className="team-message">{msg}</p>
   </div>

   <aside className="team-panel team-pool-panel"><p className="eyebrow">SPILLERPOOL</p><h2>Velg spillere</h2><p className="team-muted">Prisene er låst for hele 2026/27-sesongen.</p>
    <input className="team-search" placeholder="Søk etter spiller eller lag …" value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="team-filter-row">{(["ALL","F","D","G"] as const).map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div>
    <select className="team-line-select" aria-label="Filtrer på klubb" value={clubFilter} onChange={e=>setClubFilter(e.target.value)}><option value="ALL">Alle klubber</option>{clubs.map(club=><option key={club} value={club}>{club}</option>)}</select>
    <div className="team-pool-list" style={{marginTop:12}}>{visible.map(p=>{const on=selected.includes(p.id),clubFull=(clubCounts.get(p.team)||0)>=rules.max_players_per_club;return <button key={p.id} className="team-pool-player" onClick={()=>toggle(p)} disabled={on||clubFull}><div><strong onClick={e=>{e.stopPropagation();window.location.assign(`/fantasy/players/${p.id}`)}} title="Åpne spillerprofil" style={{textDecoration:"underline",textUnderlineOffset:3}}>{p.name}</strong><small>{p.team} · {p.position} · {p.price.toFixed(1)}m{clubFull&&!on?` · klubbgrense ${rules.max_players_per_club}/${rules.max_players_per_club}`:""}</small></div><span>{on?"✓":"+"}</span></button>})}</div>
    <div className="team-price-lock">🔒 Faste spillerpriser hele sesongen</div>
   </aside>
  </section>

  <section className="team-info-grid">
   <article className="team-info-card"><h3>↪ Slik fungerer det</h3><p>Maks 2 bytter per fantasy-runde.</p><p>Bytter må gjøres før rundens deadline.</p><p>Flytting mellom 1. og 2. rekke er gratis.</p><p>Kaptein og visekaptein kan endres gratis.</p></article>
   <article className="team-info-card"><h3>✓ Oppstilling</h3><p>Hver rekke vises som keeper, 2 backer og 3 forwards.</p><p>Spillerprisene endres ikke i løpet av sesongen.</p></article>
   <article className="team-info-card"><h3>🛡 Lagre laget ditt</h3><p>Husk å lagre når du er ferdig med bytter eller oppstillingsendringer.</p><p>Laget fryses automatisk ved rundens deadline.</p></article>
  </section>
 </main>
}
