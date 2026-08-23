"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
import "../fantasy.css";
import "./transfers.css";

type PlayerMove={player_id:string;name:string;team:string;position:string;price:number};
type Batch={batch_id:string;round_no:number;created_at:string;transfer_count:number;before_cost:number;after_cost:number;outgoing:PlayerMove[];incoming:PlayerMove[]};

const fmt=(v:number)=>`${Number(v).toFixed(1)}m`;

export default function TransfersPage(){
 const[rows,setRows]=useState<Batch[]>([]),[msg,setMsg]=useState("Laster transferhistorikk …");
 useEffect(()=>{(async()=>{try{const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");const{data:session}=await s.auth.getSession();if(!session.session)throw new Error("Du må være logget inn");const{data,error}=await s.rpc("get_my_fantasy_transfer_history_v1",{p_season:"2026/27"});if(error)throw error;setRows(((data||[])as any[]).map(x=>({...x,round_no:Number(x.round_no),transfer_count:Number(x.transfer_count),before_cost:Number(x.before_cost),after_cost:Number(x.after_cost),outgoing:x.outgoing||[],incoming:x.incoming||[]})));setMsg("")}catch(e:any){setMsg(`Kunne ikke laste historikk: ${e.message||e}`)}})()},[]);
 return <main className="fantasy-shell transfer-shell">
  <header className="transfer-head"><p className="fantasy-kicker">STANG INN · FANTASY 2026/27</p><h1>Bytter</h1><p>Gjennomførte spillerbytter på det permanente 100m-laget.</p></header>
  <section className="transfer-rules"><h2>Transferregler</h2><div className="transfer-rule-grid"><article><strong>2 bytter</strong><span>per ordinær fantasy-runde. Ubrukte bytter spares ikke.</span></article><article><strong>4 med Bytteboost</strong><span>kortet låses når lagret transferbruk passerer 2.</span></article><article><strong>Ingen poengtrekk</strong><span>det er hard grense; ekstra transfers kan ikke kjøpes med poeng.</span></article><article><strong>Lagre = gjennomført</strong><span>du kan prøve fritt før lagring. Et lagret bytte refunderes ikke.</span></article></div><p>Rekke, kaptein og visekaptein kan endres uten at det teller som spillerbytte. Permanente transfers er sperret i Rik Onkel/Fattig Onkel-runder.</p></section>
  <section className="transfer-history"><div className="transfer-history-title"><h2>Historikk</h2><a href="/fantasy/team">Til Mitt lag →</a></div>{msg&&<p className="transfer-empty">{msg}</p>}{!msg&&rows.length===0&&<p className="transfer-empty">Ingen gjennomførte transfers ennå.</p>}{rows.map(b=><article className="transfer-batch" key={b.batch_id}><div className="transfer-batch-top"><div><strong>Runde {b.round_no}</strong><span>{new Date(b.created_at).toLocaleString("nb-NO")}</span></div><div><b>{b.transfer_count} {b.transfer_count===1?"bytte":"bytter"}</b><span>{fmt(b.before_cost)} → {fmt(b.after_cost)}</span></div></div><div className="transfer-moves"><div><h3>UT</h3>{b.outgoing.map(p=><div className="transfer-player" key={`out-${p.player_id}`}><span><strong>{p.name}</strong><small>{p.team} · {p.position}</small></span><b>{fmt(p.price)}</b></div>)}</div><div><h3>INN</h3>{b.incoming.map(p=><div className="transfer-player" key={`in-${p.player_id}`}><span><strong>{p.name}</strong><small>{p.team} · {p.position}</small></span><b>{fmt(p.price)}</b></div>)}</div></div></article>)}</section>
 </main>
}
