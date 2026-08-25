"use client";

import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {getSupabaseBrowserClient} from "../../lib/supabase";
import SIIcon from "../../components/SIIcon";

const SEASON="2026/27";
type League={league_id:string;league_name:string;invite_code:string;my_role:string;member_count:number;created_at:string};
type View="tipping"|"fantasy";

export default function Page(){
 const search=useSearchParams();
 const preferred:View=search.get("view")==="fantasy"?"fantasy":"tipping";
 const[leagues,setLeagues]=useState<League[]>([]),[name,setName]=useState(""),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function load(){const sb=getSupabaseBrowserClient();if(!sb)return;const{data,error}=await sb.rpc("get_my_stang_inn_private_leagues_v1",{p_season:SEASON});if(error)setMessage(error.message);else setLeagues((data||[]) as League[])}
 useEffect(()=>{load()},[]);
 async function createLeague(){const clean=name.trim();if(clean.length<2)return;setBusy(true);setMessage("");const sb=getSupabaseBrowserClient();if(!sb){setBusy(false);return}const{data,error}=await sb.rpc("create_stang_inn_private_league_v1",{p_season:SEASON,p_name:clean});setBusy(false);if(error)setMessage(error.message);else window.location.assign(`/leagues/${data}?view=${preferred}`)}
 async function joinLeague(){const clean=code.trim().toUpperCase();if(!clean)return;setBusy(true);setMessage("");const sb=getSupabaseBrowserClient();if(!sb){setBusy(false);return}const{data,error}=await sb.rpc("join_stang_inn_private_league_v1",{p_season:SEASON,p_invite_code:clean});setBusy(false);if(error)setMessage(error.message);else window.location.assign(`/leagues/${data}?view=${preferred}`)}
 return <main className="appShell sharedLeaguesPage">
  <header className="topbar"><a className="brand brandButton" href="/" style={{textDecoration:"none"}}><div className="brandMark"><SIIcon name="leagues" size={27}/></div><div><p className="eyebrow">STANG INN · 2026/27</p><h1>Miniligaer</h1></div></a><a className="textButton" href={preferred==="fantasy"?"/fantasy":"/"}>Til {preferred==="fantasy"?"Fantasy":"Tipping"} →</a></header>
  <section className="pageStack sharedLeaguesStack" style={{marginTop:24}}>
   <article className="heroCard sharedLeagueHero"><div><p className="eyebrow">ÉN LIGA · TO KONKURRANSER</p><h2>Samme vennegjeng i Tipping og Fantasy</h2><p className="muted">Opprett eller bli med én gang. Medlemskapet gjelder automatisk i begge spillene, mens poeng og tabeller holdes helt separate.</p></div><div className="countdown"><strong>{leagues.length}</strong><span>mine ligaer</span></div></article>
   {message&&<article className="quoteCard"><span>Status</span><p>{message}</p></article>}
   <section className="contentGrid sharedLeagueActions">
    <article className="panel"><p className="eyebrow">OPPRETT</p><h3>Lag en miniliga</h3><p className="muted">Inviter venner med en kode. Ligaen blir synlig i både Tipping og Fantasy.</p><input className="sharedLeagueInput" value={name} onChange={e=>setName(e.target.value)} placeholder="Liganavn" maxLength={40}/><button className="primaryButton" disabled={busy||name.trim().length<2} onClick={createLeague}>{busy?"Jobber …":"Opprett miniliga"}</button></article>
    <article className="panel"><p className="eyebrow">BLI MED</p><h3>Har du en invitasjonskode?</h3><p className="muted">Du blir medlem av den samme ligaen i begge Stang Inn-spillene.</p><input className="sharedLeagueInput code" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} placeholder="Invitasjonskode" maxLength={12}/><button className="primaryButton" disabled={busy||!code.trim()} onClick={joinLeague}>{busy?"Jobber …":"Bli med"}</button></article>
   </section>
   <article className="panel sharedLeagueList"><div className="panelHeading"><div><p className="eyebrow">MINE MINILIGAER</p><h3>{leagues.length?`${leagues.length} liga${leagues.length===1?"":"er"}`:"Ingen ligaer ennå"}</h3></div><span className="statusPill">Tipping + Fantasy</span></div>
    {leagues.length===0?<div className="emptyState"><strong>Du er ikke med i noen miniliga ennå.</strong><span>Opprett en over eller bruk en invitasjonskode.</span></div>:<div className="sharedLeagueCards">{leagues.map(l=><a key={l.league_id} href={`/leagues/${l.league_id}?view=${preferred}`} className="sharedLeagueCard"><div><strong>{l.league_name}</strong><small>{l.my_role==="owner"?"Ligaeier":"Medlem"} · {l.member_count} medlem{l.member_count===1?"":"mer"}</small></div><div className="sharedLeagueCardMeta"><span className="statusPill">{l.invite_code}</span><b>Åpne →</b></div></a>)}</div>}
   </article>
  </section>
 </main>;
}
