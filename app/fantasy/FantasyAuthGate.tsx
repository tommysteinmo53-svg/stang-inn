"use client";

import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {getSupabaseBrowserClient} from "../../lib/supabase";

const publicFantasy=["/fantasy/rules"];
const hiddenAdmin=["/fantasy/admin-tools","/fantasy/admin-analysis","/fantasy/diagnose","/fantasy/scoring","/fantasy/special-teams-diagnostic"];

export default function FantasyAuthGate({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 const [ready,setReady]=useState(false);
 const bypass=publicFantasy.some(p=>pathname===p||pathname.startsWith(`${p}/`))||hiddenAdmin.some(p=>pathname===p||pathname.startsWith(`${p}/`));
 useEffect(()=>{
  if(bypass){setReady(true);return}
  let active=true;
  (async()=>{
   const s=getSupabaseBrowserClient();
   if(!s){if(active)setReady(true);return}
   const{data}=await s.auth.getSession();
   if(!active)return;
   if(!data.session){window.location.replace(`/login?next=${encodeURIComponent(pathname)}`);return}
   setReady(true);
  })();
  return()=>{active=false};
 },[pathname,bypass]);
 if(!ready&&!bypass)return <main className="fantasy-shell"><section className="team-panel"><p className="team-muted">Sjekker innlogging …</p></section></main>;
 return <>{children}</>;
}
