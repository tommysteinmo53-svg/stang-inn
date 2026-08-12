"use client";
import {useState} from "react";
import {HISTORICAL_PRICES_2025} from "../../../../lib/fantasy/historical-prices-2025";
import {getSupabaseBrowserClient} from "../../../../lib/supabase";
import "../../fantasy.css";

const norm=(v:any)=>String(v??"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
const natural=(s:string)=>{const[last,...r]=String(s||"").split(",");return r.length?`${r.join(",").trim()} ${last.trim()}`:String(s||"")};
const nameKey=(v:any)=>norm(natural(String(v||"")));
function canonTeam(v:string){const s=norm(v);if(s.includes("storhamar"))return"Storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"Stavanger";if(s.includes("valerenga"))return"Vålerenga";if(s.includes("frisk"))return"Frisk Asker";if(s.includes("sparta"))return"Sparta";if(s.includes("narvik"))return"Narvik";if(s.includes("stjernen"))return"Stjernen";if(s.includes("lillehammer"))return"Lillehammer";if(s.includes("lorenskog"))return"Lørenskog";if(s.includes("nidaros"))return"Nidaros";return String(v||"").trim()}

export default function Page(){
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState("Klar"),[rows,setRows]=useState<any[]>([]),[stats,setStats]=useState<any>(null),[diag,setDiag]=useState<any>(null);
 async function run(){setBusy(true);setDiag(null);try{
   const r=await fetch('/api/fantasy-roster-2026',{cache:'no-store'}),j=await r.json();
   if(!r.ok||!j.ok)throw new Error(j.error||'Import feilet');
   if(!j.rows?.length){setRows([]);setStats(null);setDiag(j.diagnostic||null);setMsg(`HockeyLive svarte, men 0 spillere ble tolket · kildeobjekter ${j.sourceRows||0}`);return}

   const priceMap=new Map<string,any>();
   for(const x of HISTORICAL_PRICES_2025)priceMap.set(nameKey(x[0]),x);

   let seasonRows:any[]=[];let statWarning="";
   try{
     const supabase=getSupabaseBrowserClient();
     const session=supabase?(await supabase.auth.getSession()).data.session:null;
     if(session?.access_token){
       const sr=await fetch('/api/fantasy-player-form?season=2025%2F26',{cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`}}),sj=await sr.json();
       if(sr.ok&&sj.ok)seasonRows=sj.result?.rows||[];else statWarning=sj.error||'2025/26-statistikk kunne ikke hentes';
     }else statWarning='Logg inn som admin for å koble 2025/26-statistikk';
   }catch(e:any){statWarning=e?.message||'2025/26-statistikk kunne ikke hentes'}
   const statMap=new Map<string,any>();for(const x of seasonRows)statMap.set(nameKey(x.name),x);

   const out=j.rows.map((x:any)=>{
     const p=priceMap.get(nameKey(x.name)),s=statMap.get(nameKey(x.name));
     const oldTeam=p?canonTeam(String(p[1])):(s?canonTeam(String(s.team)):null),newTeam=canonTeam(String(x.team));
     const status=!p&&!s?'Ny spiller':oldTeam&&oldTeam!==newTeam?'Klubbskifte':'Samme klubb';
     return{...x,team:newTeam,oldTeam,oldPrice:p?Number(p[2])/1e6:null,season:s||null,status};
   }).sort((a:any,b:any)=>a.team.localeCompare(b.team,'nb')||a.name.localeCompare(b.name,'nb'));
   const counts=out.reduce((m:any,x:any)=>(m[x.status]=(m[x.status]||0)+1,m),{}),withStats=out.filter((x:any)=>x.season).length,withPrice=out.filter((x:any)=>x.oldPrice!=null).length;
   setRows(out);setStats({n:out.length,teams:new Set(out.map((x:any)=>x.team)).size,withStats,withPrice,...counts});
   setMsg(`Ferdig · ${out.length} spillere · ${withStats} koblet mot validert 2025/26-statistikk${statWarning?` · ${statWarning}`:''}`)
 }catch(e:any){setMsg(e.message||'Feil')}finally{setBusy(false)}}
 return <main className="fantasy-shell"><section className="fantasy-hero"><div><p className="fantasy-kicker">STANG INN · 2026/27 ROSTER</p><h1>HockeyLive spillerimport</h1><p className="fantasy-lead">Henter faktisk 2026/27-spillerpool og kobler den mot validert 2025/26-statistikk og fantasypriser. Dette er grunnlaget for prismodell v4.1.</p></div><a className="pill" href="/fantasy">← Fantasy-sentralen</a></section><section className="fantasy-card"><button disabled={busy} onClick={run}>{busy?'Henter …':'Importer og koble 2026/27-spillere'}</button> <span>{msg}</span>
 {diag&&<pre style={{marginTop:16,padding:12,whiteSpace:'pre-wrap',background:'#fff4df',borderRadius:12,fontSize:11}}>{JSON.stringify(diag,null,2)}</pre>}
 {stats&&<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,margin:'18px 0'}}>{[["Spillere",stats.n],["Lag",stats.teams],["2025/26 stats",stats.withStats],["2025/26 pris",stats.withPrice],["Samme klubb",stats['Samme klubb']||0],["Klubbskifte",stats['Klubbskifte']||0],["Nye spillere",stats['Ny spiller']||0]].map(([a,b]:any)=><div key={a} style={{padding:14,borderRadius:12,background:'#f5f7fa'}}><b>{a}</b><div style={{fontSize:26,fontWeight:900}}>{b}</div></div>)}</div><div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:1180,borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Spiller','Pos','26/27 lag','25/26 lag','25/26 pris','K','FP','FP/K','G','A','SOG','+/−','PIM','Status'].map(h=><th key={h} style={{padding:8,textAlign:'left',background:'#eef3f8'}}>{h}</th>)}</tr></thead><tbody>{rows.map((x:any,i:number)=>{const s=x.season;return <tr key={`${x.personId||x.name}-${i}`}><td style={{padding:8,fontWeight:700}}>{x.name}</td><td>{x.position||s?.position||'—'}</td><td>{x.team}</td><td>{x.oldTeam||'—'}</td><td>{x.oldPrice!=null?`${x.oldPrice.toFixed(1)}m`:'—'}</td><td>{s?.games??'—'}</td><td>{s?.totalFP??'—'}</td><td>{s?.ppg??'—'}</td><td>{s?.goals??'—'}</td><td>{s?.assists??'—'}</td><td>{s?.shots??'—'}</td><td>{s?.plusMinus??'—'}</td><td>{s?.pim??'—'}</td><td style={{fontWeight:800}}>{x.status}</td></tr>})}</tbody></table></div></>}</section></main>}
