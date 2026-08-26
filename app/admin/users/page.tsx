"use client";

import {useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";

type AdminUser={
 id:string;
 display_name:string;
 email:string|null;
 admin:boolean;
 created_at:string|null;
 last_sign_in_at:string|null;
 email_confirmed_at:string|null;
 providers:string[];
 profile_complete:boolean;
};

function dateLabel(value:string|null){
 if(!value)return "—";
 return new Date(value).toLocaleString("no-NO",{dateStyle:"medium",timeStyle:"short"});
}

export default function AdminUsersPage(){
 const[users,setUsers]=useState<AdminUser[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState("");
 const[search,setSearch]=useState("");

 useEffect(()=>{void load()},[]);
 async function load(){
  setLoading(true);setError("");
  try{
   const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig.");
   const{data}=await s.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn.");
   const response=await fetch("/api/admin/users",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
   const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Kunne ikke hente brukere.");
   setUsers(result.users||[]);
  }catch(e:any){setError(e?.message||"Kunne ikke hente brukere.")}
  finally{setLoading(false)}
 }
 const visible=useMemo(()=>{const q=search.trim().toLowerCase();return q?users.filter(u=>`${u.display_name} ${u.email||""}`.toLowerCase().includes(q)):users},[users,search]);
 const admins=users.filter(u=>u.admin).length;
 const incomplete=users.filter(u=>!u.profile_complete).length;

 if(loading)return <main className="appShell"><p className="muted">Henter sikker brukeroversikt …</p></main>;
 if(error)return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2><p className="muted">{error}</p><a href="/admin" className="textButton">← Adminoversikt</a></article></main>;
 return <main className="appShell">
  <header className="topbar"><div className="brand"><div className="brandMark">👤</div><div><p className="eyebrow">FELLES ADMINISTRASJON</p><h1>Brukere</h1></div></div><a href="/admin" className="textButton">← Adminoversikt</a></header>
  <section className="pageStack" style={{marginTop:24}}>
   <article className="heroCard"><div><p className="eyebrow">Supabase Auth + Stang Inn-profiler</p><h2>Trygg brukeroversikt</h2><p className="muted">E-post og Auth-status hentes kun gjennom et server-side admin-endepunkt. Vanlige innloggede brukere får ikke utvidet tilgang til profildata.</p></div><span className="statusPill">Read only</span></article>
   <div className="statsGrid"><article className="miniCard"><span>Registrerte</span><strong>{users.length}</strong><small>Auth-kontoer med profil</small></article><article className="miniCard"><span>Administratorer</span><strong>{admins}</strong><small>players.admin</small></article><article className="miniCard"><span>Ufullstendige profiler</span><strong>{incomplete}</strong><small>{incomplete===0?"Alle profiler ser komplette ut":"Krever kontroll"}</small></article></div>
   <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Registrerte brukere</p><h3>Profiler og innlogging</h3></div><span className="statusPill">{visible.length} vist</span></div>
    <input className="matchSearch" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Søk navn eller e-post …" style={{width:"100%",marginBottom:14}}/>
    <div className="tableWrap"><table><thead><tr><th>Bruker</th><th>Rolle</th><th>Innlogging</th><th>Registrert</th><th>Sist innlogget</th><th>Status</th></tr></thead><tbody>{visible.map(user=><tr key={user.id}><td><strong>{user.display_name||"Uten profilnavn"}</strong><div className="muted" style={{fontSize:12,marginTop:3}}>{user.email||"Ingen e-post"}</div></td><td>{user.admin?<span className="statusPill">Administrator</span>:"Spiller"}</td><td>{user.providers.length?user.providers.join(" + "):"Ukjent"}</td><td>{dateLabel(user.created_at)}</td><td>{dateLabel(user.last_sign_in_at)}</td><td>{!user.profile_complete?<span style={{fontWeight:800,color:"#ffb3bd"}}>Profil mangler data</span>:!user.email_confirmed_at?<span style={{fontWeight:800,color:"#f0c86b"}}>Ikke bekreftet</span>:<span style={{fontWeight:800}}>✓ Klar</span>}</td></tr>)}</tbody></table></div>
    {visible.length===0&&<p className="muted" style={{marginTop:14}}>Ingen brukere matcher søket.</p>}
   </article>
   <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Neste sikkerhetssteg</p><h3>Ingen skrivehandlinger i denne versjonen</h3></div><span className="statusPill">Bevisst avgrenset</span></div><p className="muted">Profilendring, adminrolle, deaktivering og eventuell sletting bygges separat etter at konsekvenser, sperrer og auditlogg er definert og testet.</p></article>
  </section>
 </main>;
}
