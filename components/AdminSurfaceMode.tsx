"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";

const isAdminSurface=(p:string)=>p.startsWith("/admin")||p.startsWith("/fantasy/admin-analysis")||p.startsWith("/fantasy/diagnose")||p.startsWith("/fantasy/special-teams-diagnostic");
const emoji=/\p{Extended_Pictographic}\uFE0F?/gu;

function stripEmoji(root:ParentNode){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes:Text[]=[];let node:Node|null;
 while((node=walker.nextNode()))nodes.push(node as Text);
 for(const text of nodes){if(text.parentElement?.closest("script,style,svg"))continue;const next=(text.nodeValue||"").replace(emoji,"").replace(/\s{2,}/g," ");if(next!==text.nodeValue)text.nodeValue=next}
}

export default function AdminSurfaceMode(){
 const pathname=usePathname();
 useEffect(()=>{
  const active=isAdminSurface(pathname);document.body.classList.toggle("stangAdminSurface",active);
  if(!active)return()=>document.body.classList.remove("stangAdminSurface");
  const run=()=>stripEmoji(document.body);run();
  const observer=new MutationObserver(()=>run());observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  return()=>{observer.disconnect();document.body.classList.remove("stangAdminSurface")};
 },[pathname]);
 return null;
}
