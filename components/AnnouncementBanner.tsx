"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Announcement={id:number;message:string;created_at:string};

export default function AnnouncementBanner(){
  const [item,setItem]=useState<Announcement|null>(null);
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{(async()=>{
    const s=getSupabaseBrowserClient(); if(!s)return;
    const {data}=await s.from("announcements").select("id,message,created_at").eq("active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(data)setItem(data as Announcement);
  })();},[]);
  if(!item||hidden)return null;
  return <div style={{position:"fixed",left:"50%",transform:"translateX(-50%)",top:62,zIndex:78,width:"min(680px,calc(100vw - 28px))",padding:"11px 13px",borderRadius:14,border:"1px solid rgba(245,196,81,.42)",background:"rgba(35,28,8,.96)",color:"#fff3c4",boxShadow:"0 12px 32px rgba(0,0,0,.32)",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><span><b>📢 Beskjed:</b> {item.message}</span><button onClick={()=>setHidden(true)} style={{border:0,background:"transparent",color:"#fff3c4",fontSize:18}}>✕</button></div>;
}
