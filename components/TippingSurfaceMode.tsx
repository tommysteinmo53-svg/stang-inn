"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";

const isTippingSurface=(p:string)=>p.startsWith("/tips")||p.startsWith("/tabletips")||p.startsWith("/leaderboard")||p.startsWith("/awards")||p.startsWith("/round")||p.startsWith("/match/")||p.startsWith("/player/");

export default function TippingSurfaceMode(){
 const pathname=usePathname();
 useEffect(()=>{const active=isTippingSurface(pathname);document.body.classList.toggle("stangTippingSurface",active);return()=>document.body.classList.remove("stangTippingSurface")},[pathname]);
 return null;
}
