"use client";

import {useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";

const SEASON="2026/27";
type Row={standings_position:number;user_id:string;display_name:string;team_id:string|null;team_name:string;total_points:number;rounds_scored:number;round_wins:number;best_round_points:number;average_round_points:number;last_round_no:number|null;last_round_points:number|null;member_role:string;joined_at:string};
const pts=(v:unknown)=>Number(v||0).toFixed(1).replace(".0","");

export default function FantasyLeaguePage(){
 const params=useParams<{id:string}>(),leagueId=String(params?.id||"");
 const[auth,setAuth]=useState<boolean|null>(null),[rows,setRows]=useState<Row[]>([]),[name,setName]=useState("Privat liga"),[code,setCode]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[me,setMe]=useState<string|null>(null);
 async function load(){setBusy(true);setMsg("");try{const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");const{data:s}=await sb.auth.getSession();const user=s.session?.user;if(!user){setAuth(false);return}setAuth(true);setMe(user.id);const[{data:r,error},{data:mine,error:meError}]=await Promise.all([sb.rpc("get_fantasy_private_league_standings_v1",{p_league_id:leagueId,p_season:SEASON}),sb.rpc("get_my_fantasy_private_leagues_v1",{p_season:SEASON})]);if(error)throw error;if(meError)throw meError;setRows((r||[]) as Row[]);const l=(mine||[]).find((x:any)=>x.league_id===leagueId);if(l){setName(l.league_name);setCode(l.invite_code)}}catch(e:any){setMsg(e?.message||String(e))}finally{setBusy(false)}}
 useEffect(()=>{if(leagueId)load()},[leagueId]);
 const members=rows.length,leader=rows[0],myRow=rows.find(r=>r.user_id===me),owners=useMemo(()=>rows.filter(r=>r.member_role==="owner"),[rows]);
 async function copyCode(){try{await navigator.clipboard.writeText(code);setMsg("Invitasjonskoden er kopiert.")}catch{setMsg(`Invitasjonskode: ${code}`)}}
 if(auth===null)return <main className="fantasy-shell"><p className="fantasy-lead">Laster liga …</p></main>;
 if(!auth)return <main className="fantasy-shell"><section className="team-panel"><h1>Privat liga</h1><p className="team-muted">Du må være logget inn.</p></section></main>;
 return <main className="fantasy-shell leaderboard-shell">
  <section className="team-builder-head"><div><p className="fantasy-kicker">STANG INN · PRIVAT FANTASYLIGA</p><h1>{name}</h1><p>{members} medlem{members===1?"":"mer"} · {owners.length?`Opprettet av ${owners[0].display_name}`:"Privat liga"}</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="leaderboard-refresh" onClick={load} disabled={busy}>{busy?"Oppdaterer …":"↻ Oppdater"}</button><a className="leaderboard-refresh" href="/fantasy/leagues" style={{textDecoration:"none"}}>← Mine ligaer</a></div></section>
  <section className="leaderboard-summary"><article><small>Leder</small><strong>{leader?.team_name||"—"}</strong><span>{leader?`${pts(leader.total_points)} poeng`:"Ingen poeng ennå"}</span></article><article><small>Min plass</small><strong>{myRow?`${myRow.standings_position}. plass`:"—"}</strong><span>{myRow?`${pts(myRow.total_points)} poeng`:"Ikke funnet"}</span></article><article><small>Invitasjonskode</small><strong>{code||"—"}</strong><span><button onClick={copyCode} style={{marginTop:6}}>Kopier kode</button></span></article></section>
  {msg&&<p className="team-error">{msg}</p>}
  <section className="team-panel leaderboard-table-panel"><div className="leaderboard-section-head"><div><p className="eyebrow">LIGATABELL</p><h2>Stillingen</h2></div><span className="team-muted">Samme sesongpoeng som globalt leaderboard</span></div>{rows.length===0?<div className="leaderboard-empty"><strong>Ingen medlemmer å vise.</strong></div>:<div className="leaderboard-list"><div className="leaderboard-columns"><span>Plass</span><span>Lag</span><span>Poeng</span><span>Seire</span><span>Snitt</span><span>Siste</span><span/></div>{rows.map(r=><div className={`leaderboard-entry ${r.standings_position<=3?"podium":""} ${r.user_id===me?"mine":""}`} key={r.user_id}><div className="leaderboard-row"><span className="leaderboard-rank">{r.standings_position===1?"🥇":r.standings_position===2?"🥈":r.standings_position===3?"🥉":`${r.standings_position}.`}</span><span className="leaderboard-team"><strong>{r.team_name}{r.user_id===me&&<em>MITT LAG</em>}</strong><small>{r.display_name} · {r.member_role==="owner"?"👑 Eier":"Medlem"}</small></span><span className="leaderboard-points"><small>Poeng</small><b>{pts(r.total_points)}</b></span><span><small>Seire</small><b>{r.round_wins}</b></span><span><small>Snitt</small><b>{pts(r.average_round_points)}</b></span><span><small>Siste</small><b>{r.last_round_no?`${pts(r.last_round_points)} p`:"—"}</b></span><span/></div></div>)}</div>}</section>
  <section className="team-panel" style={{marginTop:18}}><div className="leaderboard-section-head"><div><p className="eyebrow">MEDLEMMER</p><h2>{members} spiller{members===1?"":"e"}</h2></div></div><div className="leaderboard-history-grid">{rows.map(r=><article key={`member-${r.user_id}`}><span>{r.member_role==="owner"?"👑 Ligaeier":"Medlem"}</span><strong>{r.display_name}</strong><small>{r.team_name} · med siden {new Date(r.joined_at).toLocaleDateString("nb-NO")}</small></article>)}</div></section>
 </main>
}
