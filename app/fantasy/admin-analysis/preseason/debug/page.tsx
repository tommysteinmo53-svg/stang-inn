"use client";

import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../../../lib/supabase";
import "../../../fantasy.css";
import "../../xfp-admin.css";

export default function PreseasonPreviewDebugPage(){
 const[result,setResult]=useState<any>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{try{
  const sb=getSupabaseBrowserClient();if(!sb)throw new Error("Supabase er ikke tilgjengelig");
  const{data}=await sb.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Du må være logget inn");
  const res=await fetch("/api/admin/fantasy/preseason-preview-debug",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  const body=await res.json();setResult(body);
 }catch(e:any){setResult({ok:false,error:e?.message||String(e)})}finally{setLoading(false)}})()},[]);
 return <main className="fantasy-shell xfp-command-center"><section className="xfp-panel"><p className="eyebrow">ADMIN DEBUG</p><h1>Preseason preview RPC</h1>{loading?<p>Tester …</p>:<pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{JSON.stringify(result,null,2)}</pre>}<p><a href="/fantasy/admin-analysis/preseason">← Tilbake til Preseason-form</a></p></section></main>;
}
