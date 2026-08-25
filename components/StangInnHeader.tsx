"use client";

import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Hjem", active: (p: string) => p === "/" },
  { href: "/fantasy", label: "Fantasy", active: (p: string) => p === "/fantasy" || p.startsWith("/fantasy/") },
  { href: "/tips", label: "Tipping", active: (p: string) => p.startsWith("/tips") || p.startsWith("/round") || p.startsWith("/tabletips") || p.startsWith("/match/") },
  { href: "/leagues", label: "Miniligaer", active: (p: string) => p.startsWith("/leagues") },
  { href: "/leaderboard", label: "Statistikk", active: (p: string) => p.startsWith("/leaderboard") || p.startsWith("/awards") || p.startsWith("/player/") },
  { href: "/fantasy/rules", label: "Regler", active: (p: string) => p.startsWith("/fantasy/rules") },
];

export default function StangInnHeader() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="siHeader">
      <div className="siHeaderInner">
        <a className="siBrand" href="/" aria-label="Stang Inn – hjem">
          <img src="/stang-inn-mark.svg" alt="" width="54" height="41" />
          <span className="siWordmark"><strong>STANG INN</strong><small>TIPPING &amp; FANTASY</small></span>
        </a>
        <nav className="siDesktopNav" aria-label="Stang Inn hovedmeny">
          {nav.map(item => {
            const active = item.active(pathname);
            return <a key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>{item.label}</a>;
          })}
        </nav>
        <div className="siHeaderActions">
          <a href="/notifications" className="siIconAction" aria-label="Varsler">♢</a>
          <a href="/profile" className="siProfileAction" aria-label="Profil"><span>Profil</span></a>
        </div>
      </div>
    </header>
  );
}
