"use client";

import {usePathname} from "next/navigation";

export default function GameModeSwitch(){
 const pathname=usePathname();
 if(pathname==="/login")return null;
 const fantasy=pathname==="/fantasy"||pathname.startsWith("/fantasy/");
 return <nav className="gameModeSwitch" aria-label="Bytt spillmodus">
  <a href="/" className={`gameModeOption ${!fantasy?"active":""}`} aria-current={!fantasy?"page":undefined}>
   <span className="gameModeIcon">🏒</span><span><small>STANG INN</small><strong>Hockeytips</strong></span>
  </a>
  <a href="/fantasy" className={`gameModeOption ${fantasy?"active":""}`} aria-current={fantasy?"page":undefined}>
   <span className="gameModeIcon">⭐</span><span><small>EHL 2026/27</small><strong>Fantasy</strong></span>
  </a>
 </nav>;
}
