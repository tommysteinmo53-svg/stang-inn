"use client";

import {usePathname} from "next/navigation";

export default function TippingSectionNav(){
 const path=usePathname();
 return <nav className="tippingSectionNav" aria-label="Tipping">
  <a href="/tips" className={path.startsWith("/tips")?"active":""}>Kamptips</a>
  <a href="/tabletips" className={path.startsWith("/tabletips")?"active":""}>Tabelltips</a>
 </nav>;
}
