"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";

const isAdminSurface=(p:string)=>p.startsWith("/admin")||p.startsWith("/fantasy/admin-analysis")||p.startsWith("/fantasy/diagnose")||p.startsWith("/fantasy/special-teams-diagnostic");

export default function AdminSurfaceMode(){
 const pathname=usePathname();
 useEffect(()=>{const active=isAdminSurface(pathname);document.body.classList.toggle("stangAdminSurface",active);return()=>document.body.classList.remove("stangAdminSurface")},[pathname]);
 return null;
}
