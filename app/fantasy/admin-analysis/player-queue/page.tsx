"use client";

import {useCallback,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";

type Row={
  id:string;status:string;detected_at:string;position_source?:string|null;suggested_price?:number|null;
  suggestion_model?:string|null;price_confidence?:string|null;needs_manual_price:boolean;approved_price?:number|null;
  pricing_basis?:Record<string,any>|null;admin_note?:string|null;fantasy_players:any;
};

export default function PlayerQueuePage(){
  const[rows,setRows]=useState<Row[]>([]),[msg,setMsg]=useState("Laster spillerkø …"),[busy,setBusy]=useState<string|null>(null);
  const[prices,setPrices]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    try{
      const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await s.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");
      const res=await fetch("/api/admin/fantasy/player-queue",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Kunne ikke laste kø");
      setRows(body.rows||[]);
      const next:Record<string,string>={};for(const r of body.rows||[])next[r.id]=r.suggested_price!=null?String(r.suggested_price):"";setPrices(next);
      const pending=(body.rows||[]).filter((r:Row)=>r.status==="pending").length;
      setMsg(`${pending} spiller${pending===1?"":"e"} venter på behandling${body.autoSuggested?` · ${body.autoSuggested} nye prisforslag beregnet`:""}`);
    }catch(e:any){setMsg(e?.message||"Kunne ikke laste spillerkø")}
  },[]);

  useEffect(()=>{load()},[load]);

  async function call(row:Row,action:"approve"|"reject"|"auto-suggest"){
    setBusy(row.id);try{
      const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await s.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");
      const payload:any={action,queueId:row.id};if(action==="approve")payload.price=Number(prices[row.id]);
      const res=await fetch("/api/admin/fantasy/player-queue",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});
      const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Operasjonen feilet");
      if(action==="approve")setMsg(`${row.fantasy_players?.name} godkjent og gjort kjøpbar`);
      else if(action==="reject")setMsg(`${row.fantasy_players?.name} avvist`);
      else setMsg(`V4.6-prisforslag beregnet på nytt for ${row.fantasy_players?.name}`);
      await load();
    }catch(e:any){setMsg(e?.message||"Operasjonen feilet")}finally{setBusy(null)}
  }

  const pending=rows.filter(r=>r.status==="pending"),history=rows.filter(r=>r.status!=="pending");
  return <main className="fantasy-shell">
    <section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · ADMIN · FANTASYHOCKEY</p><h1>Nye EHL-spillere</h1><p className="fantasy-lead">Nye spillere er sperret for kjøp til du godkjenner en fast 2026/27-pris. V4.6 beregner pris automatisk når dokumentert 2025/26-grunnlag finnes. Svakt eller manglende grunnlag flagges for manuell kontroll.</p></div><div className="fantasy-status"><span className="status-dot"/>{msg}</div></section>

    <section className="fantasy-grid">
      {pending.length===0&&<article className="fantasy-card"><h2>Ingen ventende spillere</h2><p>Køen er tom.</p></article>}
      {pending.map(r=>{const p=r.fantasy_players||{},basis=r.pricing_basis||{};return <article className="fantasy-card" key={r.id}>
        <p className="eyebrow">VENTER PÅ GODKJENNING</p><h2>{p.name}</h2><p><strong>{p.team}</strong> · {p.position} · {r.position_source||"ukjent posisjonskilde"}</p>
        <p>HockeyLive-ID: <code>{p.external_id||"mangler"}</code></p>
        {r.suggestion_model&&<div style={{marginTop:12,padding:12,border:"1px solid rgba(84,222,168,.25)",borderRadius:12}}>
          <strong>{r.suggested_price!=null?`Prisforslag ${Number(r.suggested_price).toFixed(1)}m`:"Ingen sikkert prisforslag"}</strong>
          <p style={{margin:"6px 0 0"}}>{r.suggestion_model} · sikkerhet: {r.price_confidence||"ukjent"}{r.needs_manual_price?" · ⚠️ manuell kontroll anbefalt":" · ✓ modellgrunnlag klart"}</p>
          {basis.metric&&<p style={{margin:"6px 0 0"}}>Grunnlag: {basis.historyLeague||""} · {basis.historyGames??"?"} kamper · {basis.metric}</p>}
          {basis.reason&&<p style={{margin:"6px 0 0"}}>Årsak: {basis.reason}</p>}
        </div>}
        <label style={{display:"grid",gap:6,marginTop:12}}>Fast sesongpris (m)
          <input type="number" min="1" max="20" step="0.5" value={prices[r.id]||""} onChange={e=>setPrices(x=>({...x,[r.id]:e.target.value}))} placeholder="f.eks. 7.5"/>
        </label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
          <button disabled={busy===r.id||!prices[r.id]} onClick={()=>call(r,"approve")}>Godkjenn pris og åpne for kjøp</button>
          <button disabled={busy===r.id} onClick={()=>call(r,"auto-suggest")}>Beregn V4.6 på nytt</button>
          <button disabled={busy===r.id} onClick={()=>call(r,"reject")}>Avvis</button>
        </div>
      </article>})}
    </section>

    <section className="fantasy-card" style={{marginTop:16}}><h2>Historikk</h2>{history.length===0?<p>Ingen tidligere behandlinger.</p>:history.map(r=><p key={r.id}><strong>{r.fantasy_players?.name}</strong> · {r.status==="approved"?`godkjent ${Number(r.approved_price).toFixed(1)}m`:"avvist"}</p>)}</section>
  </main>;
}
