"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

const style = {padding:"8px 11px",borderRadius:999,border:"1px solid rgba(245,196,81,.35)",background:"rgba(8,23,41,.94)",color:"#f8d982",textDecoration:"none",fontSize:12,fontWeight:900} as const;

export default function AdminShortcut(){
  const [admin,setAdmin]=useState(false);
  useEffect(()=>{(async()=>{
    const s=getSupabaseBrowserClient(); if(!s)return;
    const {data:session}=await s.auth.getSession(); const id=session.session?.user.id; if(!id)return;
    const {data}=await s.from("players").select("admin").eq("id",id).maybeSingle(); setAdmin(Boolean(data?.admin));
  })();},[]);
  if(!admin)return null;
  return <div style={{position:"fixed",right:14,bottom:72,zIndex:79,display:"flex",gap:7,flexDirection:"column",alignItems:"flex-end"}}>
    <a href="/admin/notifications" style={style}>📢 Send varsel</a>
    <a href="/admin/season" style={style}>⚙️ Sesongdrift</a>
  </div>;
}
