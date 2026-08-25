"use client";

import {usePathname} from "next/navigation";

export default function TippingSectionNav(){
 const path=usePathname();
 return <nav className="tippingSectionNav" aria-label="Tipping">
  <a href="/tips" className={path.startsWith("/tips")?"active":""}>Kamptips</a>
  <a href="/tabletips" className={path.startsWith("/tabletips")?"active":""}>Tabelltips</a>
  <a href="/leaderboard" className={path.startsWith("/leaderboard")?"active":""}>Leaderboard</a>
  <a href="/awards" className={path.startsWith("/awards")||path.startsWith("/player/")?"active":""}>Statistikk</a>
 </nav>;
}
