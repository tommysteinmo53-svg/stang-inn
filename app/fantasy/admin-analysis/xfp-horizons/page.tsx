"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";
import "./xfp-horizons.css";

type Row={
  player_id:string;player_name:string;team:string;player_position:string;price:number;data_confidence:string;
  season_ppg:number;form_ppg:number;next_opponent:string|null;next_game_at:string|null;next_is_home:boolean|null;
  next_round_no:number;next_round_name:string;next_round_games:number;next3_round_games:number;
  base_xfp_next_game:number;base_xfp_next_round:number;base_xfp_next3_rounds:number;
  adjusted_xfp_next_game:number;adjusted_xfp_next_round:number;adjusted_xfp_next3_rounds:number;value_next3_rounds:number;
  availability_status:string;availability_factor:number;availability_adjustment:string;
};
type PriceAssessment={label:string;ratio:number|null};
const pos=(p:string)=>p==="C"||p==="W"||p==="F"?"F":p;
const n=(v:unknown,d=2)=>Number(v||0).toFixed(d);
const conf=(v:string)=>v==="high"?"Høy":v==="medium"?"Middels":"Lav";
const median=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);if(!v.length)return 0;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2};
const nextLabel=(r:Row)=>{if(!r.next_game_at||!r.next_opponent)return"—";const d=new Date(r.next_game_at);return`${r.next_is_home?"vs":"@"} ${r.next_opponent} · ${d.toLocaleDateString("nb-NO",{day:"2-digit",month:"2-digit"})} ${d.toLocaleTimeString("nb-NO",{hour:"2-digit",minute:"2-digit"})}`};

export default function XfpHorizonsPage(){
  const[rows,setRows]=useState<Row[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(true);
  const[q,setQ]=useState(""),[team,setTeam]=useState("ALL"),[position,setPosition]=useState("ALL"),[availability,setAvailability]=useState("ALL"),[onlyRoundGame,setOnlyRoundGame]=useState(false);
  async function load(){
    setBusy(true);setError("");
    try{
      const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await sb.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");
      const res=await fetch("/api/admin/fantasy/xfp-round-horizons",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke hente xFP-horisonter");setRows(body.rows||[]);
    }catch(e:any){setError(e?.message||"Kunne ikke hente data")}finally{setBusy(false)}
  }
  useEffect(()=>{load()},[]);
  const teams=useMemo(()=>Array.from(new Set(rows.map(r=>r.team))).sort((a,b)=>a.localeCompare(b,"nb")),[rows]);
  const availabilityOptions=useMemo(()=>Array.from(new Set(rows.map(r=>r.availability_status))).sort(),[rows]);
  const positionMedians=useMemo(()=>{const out:Record<string,number>={F:0,D:0,G:0};for(const p of ["F","D","G"])out[p]=median(rows.filter(r=>pos(r.player_position)===p&&r.value_next3_rounds>0).map(r=>r.value_next3_rounds));return out},[rows]);
  const assess=(r:Row):PriceAssessment=>{const m=positionMedians[pos(r.player_position)]||0;if(!m||r.value_next3_rounds<=0)return{label:"Uavklart",ratio:null};const ratio=r.value_next3_rounds/m;if(ratio>=1.15)return{label:"Underpriset",ratio};if(ratio<=.85)return{label:"Overpriset",ratio};return{label:"Rimelig",ratio}};
  const shown=useMemo(()=>rows.filter(r=>{
    const needle=q.trim().toLowerCase();
    return(!needle||`${r.player_name} ${r.team}`.toLowerCase().includes(needle))
      &&(team==="ALL"||r.team===team)
      &&(position==="ALL"||pos(r.player_position)===position)
      &&(availability==="ALL"||r.availability_status===availability)
      &&(!onlyRoundGame||r.next_round_games>0);
  }).sort((a,b)=>b.adjusted_xfp_next3_rounds-a.adjusted_xfp_next3_rounds||a.player_name.localeCompare(b.player_name,"nb")),[rows,q,team,position,availability,onlyRoundGame]);
  const hasFilters=!!q||team!=="ALL"||position!=="ALL"||availability!=="ALL"||onlyRoundGame;
  const reset=()=>{setQ("");setTeam("ALL");setPosition("ALL");setAvailability("ALL");setOnlyRoundGame(false)};
  const round=rows[0]?.next_round_name||"Neste fantasy-runde";

  return <main className="fantasy-shell horizon-shell">
    <section className="horizon-hero"><p className="fantasy-kicker">MP-08.8 · ADMIN ANALYSE</p><h1>xFP – neste kamp, runde og tre runder</h1><p><strong>Spiller-xFP:</strong> base-modell → availability-justering. Rekke 1/2 og C/VC legges først på når en konkret lagoppstilling vurderes i optimizer/laganalyse.</p></section>
    <section className="horizon-panel">
      <div className="horizon-head"><div><h2>xFP-rangering</h2><p>{round} · viser <strong>{shown.length}</strong> av {rows.length} spillere</p></div><button onClick={load} disabled={busy}>{busy?"Laster …":"↻ Oppdater"}</button></div>
      <div className="horizon-filters" aria-label="Filtrer xFP-rangering">
        <label><span>Søk</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Spiller eller lag"/></label>
        <label><span>Lag</span><select value={team} onChange={e=>setTeam(e.target.value)}><option value="ALL">Alle lag</option>{teams.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
        <label><span>Posisjon</span><select value={position} onChange={e=>setPosition(e.target.value)}><option value="ALL">Alle posisjoner</option><option value="F">Forward</option><option value="D">Back</option><option value="G">Keeper</option></select></label>
        <label><span>Availability</span><select value={availability} onChange={e=>setAvailability(e.target.value)}><option value="ALL">Alle statuser</option>{availabilityOptions.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
        <label className="horizon-check"><input type="checkbox" checked={onlyRoundGame} onChange={e=>setOnlyRoundGame(e.target.checked)}/><span>Kun spillere med kamp i neste runde</span></label>
        <button className="horizon-reset" onClick={reset} disabled={!hasFilters}>Nullstill filtre</button>
      </div>
      {error&&<p className="horizon-error">{error}</p>}
      <div className="horizon-table-wrap"><table><thead><tr><th>Spiller</th><th>Lag</th><th>Pos</th><th>Pris</th><th>Sesong</th><th>Form 5</th><th>Neste kamp</th><th>Base xFP kamp</th><th>Justert xFP kamp</th><th>xFP neste runde</th><th>Kamper</th><th>xFP 3 runder</th><th>Kamper</th><th>Verdi</th><th>Prisvurdering</th><th>Availability</th><th>Data</th></tr></thead><tbody>
        {shown.map(r=>{const pa=assess(r);return <tr key={r.player_id}><td><strong>{r.player_name}</strong></td><td>{r.team}</td><td>{pos(r.player_position)}</td><td>{n(r.price,1)}m</td><td>{n(r.season_ppg)}</td><td>{n(r.form_ppg)}</td><td>{nextLabel(r)}</td><td>{n(r.base_xfp_next_game)}</td><td className="xfp-now">{n(r.adjusted_xfp_next_game)}</td><td className="xfp-round">{n(r.adjusted_xfp_next_round)}</td><td>{r.next_round_games}</td><td className="xfp-three">{n(r.adjusted_xfp_next3_rounds)}</td><td>{r.next3_round_games}</td><td>{n(r.value_next3_rounds,3)}</td><td><strong>{pa.label}</strong>{pa.ratio!==null&&<small>{Math.round((pa.ratio-1)*100)>0?"+":""}{Math.round((pa.ratio-1)*100)} % vs pos.</small>}</td><td><span className={`availability ${r.availability_status}`}>{r.availability_status}</span><small>{Math.round(r.availability_factor*100)} %</small></td><td>{conf(r.data_confidence)}</td></tr>})}
        {!busy&&!shown.length&&<tr><td colSpan={17} className="empty">Ingen spillere matcher filtrene.</td></tr>}
      </tbody></table></div>
      <p className="horizon-note"><strong>Verdi</strong> = availability-justert xFP for de neste tre fantasy-rundene per million. <strong>Prisvurdering</strong> sammenligner dette mot medianen for samme posisjon. Tallene i rundehorisontene summerer alle kampene spilleren faktisk har i de kalenderbaserte fantasy-rundene.</p>
    </section>
  </main>;
}
