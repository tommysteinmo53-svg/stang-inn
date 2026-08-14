"use client";
import {usePathname} from "next/navigation";
export default function HockeytipsLeagueShortcut(){
 const pathname=usePathname();
 if(pathname.startsWith("/fantasy")||pathname.startsWith("/admin")||pathname.startsWith("/login"))return null;
 const active=pathname.startsWith("/leagues");
 return <div style={{maxWidth:1180,margin:"10px auto 0",padding:"0 18px"}}><a href="/leagues" className="textButton" style={{display:"inline-flex",alignItems:"center",gap:7,textDecoration:"none",fontWeight:900}} aria-current={active?"page":undefined}>🤝 Private ligaer</a></div>;
}
