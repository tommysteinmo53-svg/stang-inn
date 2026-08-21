"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";

type Tool={href:string;icon:string;title:string;text:string;badge?:string};
type Group={title:string;eyebrow:string;description:string;tools:Tool[]};

const cardStyle={display:"block",textDecoration:"none",color:"inherit",minHeight:165} as const;

export default function FantasyAdminPage(){
  const[allowed,setAllowed]=useState<boolean|null>(null),[message,setMessage]=useState("Sjekker admin-tilgang …"),[pending,setPending]=useState<number|null>(null);

  useEffect(()=>{(async()=>{
    try{
      const s=getSupabaseBrowserClient();if(!s)throw new Error("Supabase er ikke tilgjengelig");
      const{data}=await s.auth.getSession();const user=data.session?.user,token=data.session?.access_token;
      if(!user||!token){setAllowed(false);setMessage("Du må være logget inn");return}
      const{data:player,error}=await s.from("players").select("admin").eq("id",user.id).maybeSingle();
      if(error||!player?.admin){setAllowed(false);setMessage("Denne siden er bare for administrator");return}
      setAllowed(true);setMessage("Fantasy-admin aktiv");
      const res=await fetch("/api/admin/fantasy/player-queue",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body=await res.json();if(res.ok&&body.ok)setPending((body.rows||[]).filter((r:any)=>r.status==="pending").length);
    }catch(e:any){setAllowed(false);setMessage(e?.message||"Kunne ikke kontrollere admin-tilgang")}
  })()},[]);

  if(allowed===null)return <main className="appShell"><p className="muted">{message}</p></main>;
  if(!allowed)return <main className="appShell"><article className="panel"><h2>Ingen tilgang</h2><p className="muted">{message}</p><a href="/admin" className="textButton">← Adminoversikt</a></article></main>;

  const groups:Group[]=[
    {
      eyebrow:"MP-08 · MP-10",title:"Analyse og optimalisering",description:"xFP, anbefalinger, fixture-rating og lagoptimalisering.",
      tools:[
        {href:"/fantasy/admin-analysis",icon:"📊",title:"Fantasy-kommandosenter",text:"Spillerradar, Kjøp/Hold/Selg/Kaptein, xFP-horisonter, filtre, verdi og modellvekter.",badge:"Hovedside"},
        {href:"/fantasy/admin-analysis/optimizer",icon:"🧠",title:"Lagoptimalisator",text:"Beste komplette lag og konkrete UT → INN-forslag med rekke-, C/VC- og availability-regler.",badge:"MP-10"},
        {href:"/fantasy/admin-analysis/fixture-rating",icon:"🗓️",title:"Fixture-rating",text:"Dynamisk motstanderrating og kontroll av matchup-faktorer som brukes i xFP.",badge:"MP-08"},
      ]
    },
    {
      eyebrow:"MP-09",title:"Skader og tilgjengelighet",description:"Autoritativ availability, kildeinnhenting, review, effekt og varsling.",
      tools:[
        {href:"/fantasy/admin-analysis/availability",icon:"🏥",title:"Availability-oversikt",text:"Gjeldende autoritative statuser, noter og forventet retur.",badge:"Status"},
        {href:"/fantasy/admin-analysis/availability/scan",icon:"🔎",title:"Kildeskann",text:"HockeyLive, nitten.no, klubb-/lokalmedier og produksjonspipeline-backtester.",badge:"Innhenting"},
        {href:"/fantasy/admin-analysis/availability/findings",icon:"✅",title:"Funn og godkjenning",text:"Review-kø for eksterne funn før de kan bli autoritativ availability.",badge:"Review"},
        {href:"/fantasy/admin-analysis/availability/impact",icon:"📉",title:"Availability-effekt",text:"Kontroller hvilke statuser som justerer xFP eller blokkerer spillere.",badge:"xFP"},
        {href:"/fantasy/admin-analysis/availability/alerts",icon:"🔔",title:"Availability-varsler",text:"Kontroll av hvilke Fantasy-lag som berøres av godkjente availability-endringer.",badge:"Varsler"},
      ]
    },
    {
      eyebrow:"MP-02 · PRESEASON",title:"Spillere, roster og treningskamper",description:"Spilleridentitet, priser, runder og preseason-datapipeline.",
      tools:[
        {href:"/admin/fantasy/roster-audit",icon:"🧾",title:"EliteProspects roster-audit",text:"Read-only kontroll av aktiv 2026/27-spillerpool mot EliteProspects-fasiten.",badge:"MP-02"},
        {href:"/admin/fantasy/player-queue",icon:"🆕",title:"Nye EHL-spillere",text:"Prisforslag V4.6, manuell kontroll og godkjenning av fast sesongpris.",badge:pending==null?"Kø":`${pending} venter`},
        {href:"/admin/fantasy/rounds",icon:"📅",title:"Fantasy-runder",text:"Administrasjon og kontroll av kalenderbaserte fantasy-runder og deadlines.",badge:"45 runder"},
        {href:"/fantasy/admin-analysis/preseason",icon:"🏒",title:"Preseason",text:"Treningskamper, HockeyLive-import, registrerte kampdata og preseason-signaler.",badge:"2026/27"},
        {href:"/fantasy/admin-analysis/preseason/source",icon:"📰",title:"Preseason · ekstern kilde",text:"Registrering og kontroll av treningskampdata fra eksterne kilder.",badge:"Kilder"},
        {href:"/fantasy/admin-analysis/preseason/debug",icon:"🧪",title:"Preseason · debug",text:"Teknisk diagnose av preseason-import og datamatching.",badge:"Debug"},
      ]
    },
    {
      eyebrow:"DRIFT",title:"Drift og hoveddiagnostikk",description:"Samlede tekniske verktøy for scoring, datakvalitet, økonomi og roster.",
      tools:[
        {href:"/admin/fantasy/tools",icon:"🔧",title:"Fantasy driftsverktøy",text:"Eksisterende HockeyLive-, roster- og tekniske adminverktøy.",badge:"Admin"},
        {href:"/fantasy/diagnose",icon:"🩺",title:"FP-diagnose",text:"Bryt ned Fantasy-poeng kategori for kategori mot kontrollgrunnlaget.",badge:"Scoring"},
        {href:"/fantasy/diagnose/scoring-backtest",icon:"🧮",title:"Scoring-backtest",text:"Kontroller poengmotoren mot historisk fasit.",badge:"MP-06"},
        {href:"/fantasy/diagnose/season-validation",icon:"🛡️",title:"Sesongvalidering",text:"Overordnet validering av kamp-, spiller- og keeperdata.",badge:"QA"},
        {href:"/fantasy/special-teams-diagnostic",icon:"⚡",title:"Special teams-diagnose",text:"Kontroll av PP/SH-relaterte scoringdata.",badge:"MP-06"},
      ]
    }
  ];

  const diagnostics:Tool[]=[
    {href:"/fantasy/diagnose/duplicate-player-check",icon:"👥",title:"Duplikatkontroll",text:"Finn mulige duplikate spilleridentiteter."},
    {href:"/fantasy/diagnose/eliteprospects",icon:"🧾",title:"EliteProspects-diagnose",text:"Teknisk EP-kontroll."},
    {href:"/fantasy/diagnose/roster-2026",icon:"📋",title:"Roster 2026",text:"2026/27-rosterdiagnose."},
    {href:"/fantasy/diagnose/roster-db-preflight",icon:"🚦",title:"Roster DB preflight",text:"Sikkerhetsgate før roster-synk."},
    {href:"/fantasy/diagnose/roster-db-sync",icon:"🔄",title:"Roster DB sync",text:"Roster-synk og resultatdiagnostikk."},
    {href:"/fantasy/diagnose/skaters",icon:"🏃",title:"Utespillerdiagnose",text:"Detaljkontroll av utespillerdata."},
    {href:"/fantasy/diagnose/skater-hl",icon:"📡",title:"Utespiller HockeyLive",text:"HockeyLive-diagnose for utespillere."},
    {href:"/fantasy/diagnose/keeper-season",icon:"🥅",title:"Keeper sesong",text:"Sesongdata for keepere."},
    {href:"/fantasy/diagnose/keeper-context",icon:"🥅",title:"Keeper kontekst",text:"Kampkontekst og keeperdata."},
    {href:"/fantasy/diagnose/keeper-reconcile",icon:"🥅",title:"Keeper reconcile",text:"Avstemming av keeperdata."},
    {href:"/fantasy/diagnose/keeper-ab",icon:"🥅",title:"Keeper A/B",text:"A/B-kontroll av keeperberegninger."},
    {href:"/fantasy/diagnose/season-validation/coverage",icon:"📊",title:"Sesong · coverage",text:"Dekningskontroll for sesongdata."},
    {href:"/fantasy/diagnose/season-validation/drilldown",icon:"🔬",title:"Sesong · drilldown",text:"Detaljert avviksanalyse."},
    {href:"/fantasy/diagnose/season-validation/final",icon:"✅",title:"Sesong · final",text:"Sluttkontroll av sesongvalidering."},
    {href:"/fantasy/diagnose/season-validation/probe",icon:"🧪",title:"Sesong · probe",text:"Teknisk rådataprobe."},
    {href:"/fantasy/diagnose/season-validation/skater-games",icon:"🏒",title:"Sesong · skater games",text:"Kontroll av utespillerkamper."},
    {href:"/fantasy/diagnose/season-validation/skater-games/all",icon:"🏒",title:"Sesong · alle skater games",text:"Komplett kampkontroll for utespillere."},
    {href:"/fantasy/diagnose/season-validation/goalie-games",icon:"🥅",title:"Sesong · goalie games",text:"Kontroll av keeperkamper."},
    {href:"/fantasy/diagnose/season-validation/goalie-games/all",icon:"🥅",title:"Sesong · alle goalie games",text:"Komplett keeperkampkontroll."},
    {href:"/fantasy/diagnose/season-validation/goalie-games/wins",icon:"🏆",title:"Keeperseire",text:"Kontroll av keeperseire."},
    {href:"/fantasy/diagnose/season-validation/goalie-games/wins/raw",icon:"🧱",title:"Keeperseire · rådata",text:"Rådata bak keeperseire."},
    {href:"/fantasy/diagnose/price-preview-v4-6-1",icon:"💰",title:"Prispreview V4.6.1",text:"Siste prispreview og markedskontroll."},
    {href:"/fantasy/diagnose/economy-stress-v4-4",icon:"🏦",title:"Economy stress V4.4",text:"Stress-test av fantasyøkonomien."},
    {href:"/fantasy/diagnose/price-market-v4-3",icon:"📈",title:"Price market V4.3",text:"Markedskalibrering for prismodellen."},
    {href:"/fantasy/diagnose/price-backtest",icon:"⏪",title:"Price backtest",text:"Historisk pristest."},
    {href:"/fantasy/diagnose/price-backtest-2025",icon:"⏪",title:"Price backtest 2025",text:"2025-spesifikk pristest."},
    {href:"/fantasy/diagnose/price-backtest-2025/explain",icon:"💬",title:"Price backtest · forklaring",text:"Forklaring av 2025-backtesten."},
    {href:"/fantasy/diagnose/price-backtest-2025/unmatched",icon:"❓",title:"Price backtest · unmatched",text:"Spillere som ikke ble matchet."},
    {href:"/fantasy/diagnose/import-backtest-v4-5",icon:"📥",title:"Import-backtest V4.5",text:"Importmodellens historiske test."},
    {href:"/fantasy/diagnose/import-backtest-v4-5-9",icon:"📥",title:"Import-backtest V4.5.9",text:"Senere V4.5-importtest."},
    {href:"/fantasy/diagnose/import-backtest-v4-6",icon:"📥",title:"Import-backtest V4.6",text:"V4.6-importtest."},
    {href:"/fantasy/diagnose/price-model-v2",icon:"🧮",title:"Prismodell V2",text:"Historisk prismodell-diagnose."},
    {href:"/fantasy/diagnose/price-model-v4",icon:"🧮",title:"Prismodell V4",text:"V4-modellvisning."},
    {href:"/fantasy/diagnose/price-model-v4/diagnose",icon:"🧪",title:"Prismodell V4 · diagnose",text:"Detaljdiagnose for V4."},
    {href:"/fantasy/diagnose/price-model-v4-1",icon:"🧮",title:"Prismodell V4.1",text:"V4.1 markedskalibrering."},
    {href:"/fantasy/diagnose/price-model-v4-2",icon:"🧮",title:"Prismodell V4.2",text:"V4.2 prismodell."},
    {href:"/fantasy/diagnose/price-model-v4-3",icon:"🧮",title:"Prismodell V4.3",text:"V4.3 prismodell."},
  ];

  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="brandMark">🏒</div><div><p className="eyebrow">ADMIN · FANTASYHOCKEY</p><h1>Fantasy-admin</h1></div></div><a href="/admin" className="textButton">← Adminoversikt</a></header>
    <section className="pageStack" style={{marginTop:24}}>
      <article className="heroCard"><div><p className="eyebrow">EHL Fantasy 2026/27</p><h2>Alle adminfunksjoner samlet</h2><p className="muted">Snarveier til analyse, optimizer, availability, roster, preseason, runder, scoring og diagnostikk. Vanlige spillersider er urørt.</p></div><span className="statusPill">✓ {message}</span></article>

      {groups.map(group=><section key={group.title} className="pageStack" style={{gap:12}}>
        <div><p className="eyebrow">{group.eyebrow}</p><h2 style={{margin:"4px 0 6px"}}>{group.title}</h2><p className="muted" style={{margin:0}}>{group.description}</p></div>
        <div className="statsGrid" style={{alignItems:"stretch"}}>{group.tools.map(c=><a key={c.href} href={c.href} className="panel" style={cardStyle}><div className="panelHeading"><div><p className="eyebrow">{c.icon} ADMINVERKTØY</p><h3>{c.title}</h3></div>{c.badge&&<span className="statusPill">{c.badge}</span>}</div><p className="muted">{c.text}</p><div style={{marginTop:14,fontWeight:900}}>Åpne →</div></a>)}</div>
      </section>)}

      <details className="panel">
        <summary style={{cursor:"pointer",fontWeight:900,fontSize:18}}>🧪 Alle diagnose- og backtestverktøy ({diagnostics.length})</summary>
        <p className="muted">Historiske prismodeller, keeper-/kampdiagnoser og tekniske backtester. Disse er beholdt tilgjengelige, men ligger sammenfoldet for å holde hovedpanelet ryddig.</p>
        <div className="statsGrid" style={{alignItems:"stretch",marginTop:14}}>{diagnostics.map(c=><a key={c.href} href={c.href} className="panel" style={{...cardStyle,minHeight:130}}><div className="panelHeading"><div><p className="eyebrow">{c.icon} DIAGNOSE</p><h3>{c.title}</h3></div></div><p className="muted">{c.text}</p><div style={{marginTop:10,fontWeight:900}}>Åpne →</div></a>)}</div>
      </details>

      <article className="panel"><div className="panelHeading"><div><p className="eyebrow">Prinsipp</p><h3>Én inngang til Fantasy-drift</h3></div><span className="statusPill">Admin only</span></div><p className="muted">Nye funksjoner bør heretter få en snarvei her når de blir produksjonsklare. Utdaterte eller erstattede verktøy skal fjernes fra snarveiene i stedet for å skape parallelle arbeidsflater.</p></article>
    </section>
  </main>;
}
