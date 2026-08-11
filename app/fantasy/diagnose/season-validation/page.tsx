"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";

type SeasonKey="2025/26"|"2024/25";
const SEASONS:Record<SeasonKey,{label:string;tournamentId:string}>={
  "2025/26":{label:"EHL 2025/26 · validert",tournamentId:"435587"},
  "2024/25":{label:"EHL 2024/25 · blindtest",tournamentId:"429162"},
};
const nk=(v:any)=>String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const sign=(v:any)=>{const n=Number(v);return !Number.isFinite(n)?"—":n>0?`+${n}`:String(n)};

export default function SeasonValidation(){
  const[season,setSeason]=useState<SeasonKey>("2024/25");
  const[skaters,setSkaters]=useState<any>(null),[goalies,setGoalies]=useState<any[]>([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
  const cfg=SEASONS[season];

  async function authToken(){const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig.");const{data}=await s.auth.getSession();if(!data.session?.access_token)throw new Error("Du må være logget inn som admin.");return data.session.access_token}
  async function run(){setBusy(true);setMsg(`Validerer ${cfg.label} …`);setSkaters(null);setGoalies([]);try{
    const token=await authToken();
    const sr=await fetch(`/api/fantasy-skater-season-check?season=${encodeURIComponent(season)}&tournamentId=${cfg.tournamentId}`,{headers:{Authorization:`Bearer ${token}`}}),sp=await sr.json();if(!sr.ok||!sp.ok)throw new Error(sp.error||"Utespillerkontroll feilet");setSkaters(sp);
    const fr=await fetch(`/api/fantasy-player-form?season=${encodeURIComponent(season)}`,{headers:{Authorization:`Bearer ${token}`}}),fp=await fr.json();if(!fr.ok||!fp.ok)throw new Error(fp.error||"Kunne ikke hente keeperdata");
    const local=(fp.result?.rows||[]).filter((r:any)=>String(r.position).toUpperCase()==="G");
    const grouped=new Map<string,any>();for(const r of local){const key=nk(r.name);if(!key)continue;const a=grouped.get(key)||{name:r.name,team:r.team,games:0,saves:0,ga:0,wins:0,so:0};a.games+=Number(r.games||0);a.saves+=Number(r.saves||0);a.ga+=Number(r.goalsAgainst||0);a.wins+=Number(r.wins||0);a.so+=Number(r.shutouts||0);grouped.set(key,a)}
    const out:any[]=[];for(const localG of grouped.values()){
      try{const rr=await fetch(`/api/fantasy-goalie-season-check?name=${encodeURIComponent(localG.name)}&tournamentId=${cfg.tournamentId}`,{headers:{Authorization:`Bearer ${token}`}}),pp=await rr.json();if(rr.ok&&pp.ok&&pp.found){const o=pp.row,d={saves:localG.saves-Number(o.saves||0),ga:localG.ga-Number(o.goalsAgainst||0),wins:localG.wins-Number(o.wins||0),so:localG.so-Number(o.shutouts||0),games:localG.games-Number(o.gamesPlayed||0)};out.push({local:localG,official:o,diffs:d,clean:d.saves===0&&d.ga===0&&d.wins===0})}else out.push({local:localG,official:null,diffs:null,clean:false,error:pp.error||"Fant ikke HockeyLive-rad"})}catch(e:any){out.push({local:localG,official:null,diffs:null,clean:false,error:e?.message||"Feil"})}
    }
    out.sort((a,b)=>Number(b.clean)-Number(a.clean)||a.local.name.localeCompare(b.local.name,"nb"));setGoalies(out);setMsg(`Ferdig ${cfg.label}.`)
  }catch(e:any){setMsg(e?.message||"Validering feilet")}finally{setBusy(false)}}

  useEffect(()=>{run()},[season]);
  const goalieMatched=goalies.filter(r=>r.official).length,goalieClean=goalies.filter(r=>r.clean).length;
  const badSkaters=useMemo(()=>skaters?.result?.filter((r:any)=>!r.clean)||[],[skaters]);
  const badGoalies=useMemo(()=>goalies.filter(r=>!r.clean),[goalies]);

  return <main className="fantasy-shell"><section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · ADMIN · FANTASY</p><h1>Sesongvalidering</h1><p className="fantasy-lead">Blindtest av samme import- og poenggrunnlag mot HockeyLive på tvers av sesonger. Ingen regler tilpasses 2024/25.</p></div><a className="pill" href="/fantasy" style={{textDecoration:"none"}}>← Fantasy-sentralen</a></section>
  <section className="fantasy-card"><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:16}}><select value={season} onChange={e=>setSeason(e.target.value as SeasonKey)} disabled={busy} style={{padding:10,borderRadius:10}}><option value="2024/25">EHL 2024/25 · blindtest</option><option value="2025/26">EHL 2025/26 · referanse</option></select><button onClick={run} disabled={busy}>{busy?"Validerer …":"Kjør validering på nytt"}</button><span>{msg}</span></div>
  {skaters&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginBottom:18}}><div style={{padding:12,background:"#eefaf2",borderRadius:12}}><b>Utespillere</b><div style={{fontSize:22,fontWeight:900}}>{skaters.clean}/{skaters.localPlayers}</div><small>råfelt matcher HockeyLive</small></div><div style={{padding:12,background:"#eefaf2",borderRadius:12}}><b>Navn matchet</b><div style={{fontSize:22,fontWeight:900}}>{skaters.matched}/{skaters.localPlayers}</div><small>utespillere</small></div><div style={{padding:12,background:goalieClean===goalies.length&&goalies.length?"#eefaf2":"#fff4df",borderRadius:12}}><b>Keepere</b><div style={{fontSize:22,fontWeight:900}}>{goalieClean}/{goalies.length}</div><small>SV · GA · W matcher</small></div><div style={{padding:12,background:"#f5f7fa",borderRadius:12}}><b>Keepernavn</b><div style={{fontSize:22,fontWeight:900}}>{goalieMatched}/{goalies.length}</div><small>matchet HockeyLive</small></div></div>
  <div style={{padding:12,border:"1px solid #b7d7c4",borderRadius:12,background:"#eefaf2",marginBottom:18}}><b>Blindtest-prinsipp:</b> Utespillere vurderes på G, A, SOG og PIM (+/− bare dersom HockeyLive leverer feltet). Keepere vurderes på SV, GA og W. SO er diagnostisk etter Stang Inn-regelen og tvinges ikke til HockeyLive-totalen.</div>
  <h2>Utespillere med avvik · {badSkaters.length}</h2>{badSkaters.length===0?<p style={{fontWeight:800,color:"#16794b"}}>✓ Alle utespillere matcher HockeyLive på kontrollerbare råfelt.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:920,fontSize:12}}><thead><tr>{["Spiller","K vår/HL","G","A","SOG","PIM","Status"].map(h=><th key={h} style={{padding:7,textAlign:"left",background:"#eef3f8"}}>{h}</th>)}</tr></thead><tbody>{badSkaters.map((r:any)=><tr key={r.local.id}><td style={{padding:7,borderBottom:"1px solid #e2e8f0",fontWeight:800}}>{r.local.name}</td>{r.official?<><td>{r.local.games}/{r.official.games} ({sign(r.diffs.games)})</td><td>{r.local.goals}/{r.official.goals} ({sign(r.diffs.goals)})</td><td>{r.local.assists}/{r.official.assists} ({sign(r.diffs.assists)})</td><td>{r.local.shots}/{r.official.shots} ({sign(r.diffs.shots)})</td><td>{r.local.pim}/{r.official.pim} ({sign(r.diffs.pim)})</td><td>⚠ Avvik</td></>:<td colSpan={6}>Fant ikke HockeyLive-rad</td>}</tr>)}</tbody></table></div>}
  <h2 style={{marginTop:26}}>Keepere med avvik · {badGoalies.length}</h2>{badGoalies.length===0&&goalies.length?<p style={{fontWeight:800,color:"#16794b"}}>✓ Alle keepere matcher HockeyLive på SV, GA og W.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:900,fontSize:12}}><thead><tr>{["Keeper","K vår/HL*","SV vår/HL","GA vår/HL","W vår/HL","SO vår/HL*","Status"].map(h=><th key={h} style={{padding:7,textAlign:"left",background:"#eef3f8"}}>{h}</th>)}</tr></thead><tbody>{badGoalies.map((r:any)=><tr key={nk(r.local.name)}><td style={{padding:7,borderBottom:"1px solid #e2e8f0",fontWeight:800}}>{r.local.name}</td>{r.official?<><td>{r.local.games}/{r.official.gamesPlayed} ({sign(r.diffs.games)})</td><td>{r.local.saves}/{r.official.saves} ({sign(r.diffs.saves)})</td><td>{r.local.ga}/{r.official.goalsAgainst} ({sign(r.diffs.ga)})</td><td>{r.local.wins}/{r.official.wins} ({sign(r.diffs.wins)})</td><td>{r.local.so}/{r.official.shutouts} ({sign(r.diffs.so)})</td><td>⚠ Statistikkavvik</td></>:<td colSpan={6}>{r.error||"Fant ikke HockeyLive-rad"}</td>}</tr>)}</tbody></table></div>}
  <p style={{fontSize:12,color:"#607086",marginTop:10}}>* Kampantall og SO er diagnostisk og påvirker ikke keeperstatus.</p></>}</section></main>}
