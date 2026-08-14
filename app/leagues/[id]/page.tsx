"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
const SEASON="2026/27";
type Row={standings_position:number;user_id:string;display_name:string;total_points:number;exact_results:number;correct_outcomes:number;scored_tips:number;member_role:string;joined_at:string};
export default function Page(){
 const params=useParams<{id:string}>();const id=params?.id;
 const[rows,setRows]=useState<Row[]>([]),[message,setMessage]=useState("");
 useEffect(()=>{(async()=>{if(!id)return;const sb=getSupabaseBrowserClient();if(!sb)return;const{data,error}=await sb.rpc("get_hockeytips_private_league_standings_v1",{p_league_id:id,p_season:SEASON});if(error)setMessage(error.message);else setRows((data||[]) as Row[])})()},[id]);
 return <main className="appShell"><header className="topbar"><a className="brand brandButton" href="/leagues" style={{textDecoration:"none"}}><div className="brandMark">🏒</div><div><p className="eyebrow">HOCKEYTIPSET · PRIVAT LIGA</p><h1>Ligatabell</h1></div></a><a className="textButton" href="/leagues">Alle ligaer →</a></header><section className="pageStack" style={{marginTop:24}}><div className="pageHeading"><div><p className="eyebrow">SESONG 2026/27</p><h2>🏆 Sammenlagt</h2><p className="muted">Samme Hockeytips-poeng som i hovedtabellen, filtrert på medlemmene i denne ligaen.</p></div></div>{message&&<article className="panel"><p>{message}</p></article>}<article className="panel standings"><div className="tableHead" style={{gridTemplateColumns:"48px 1fr 80px 80px 80px"}}><span>#</span><span>Spiller</span><span>Eksakte</span><span>Riktig</span><span>Poeng</span></div>{rows.map(r=><div key={r.user_id} className="tableRow" style={{gridTemplateColumns:"48px 1fr 80px 80px 80px"}}><span className="rank">{r.standings_position<=3?["🥇","🥈","🥉"][r.standings_position-1]:r.standings_position}</span><span><b>{r.display_name}</b><small>{r.member_role==="owner"?"Ligaeier":"Medlem"} · {r.scored_tips} avgjorte tips</small></span><span>{r.exact_results}</span><span>{r.correct_outcomes}</span><span className="points">{r.total_points}</span></div>)}{!rows.length&&!message&&<p className="muted">Ingen medlemmer å vise ennå.</p>}</article></section></main>;
}
