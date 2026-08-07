"use client";

import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "⌂", label: "Hjem", match: (p: string) => p === "/" },
  { href: "/tips", icon: "🏒", label: "Kamper", match: (p: string) => p.startsWith("/tips") || p.startsWith("/match/") },
  { href: "/round", icon: "▤", label: "Runde", match: (p: string) => p.startsWith("/round") },
  { href: "/leaderboard", icon: "🏆", label: "Tabell", match: (p: string) => p.startsWith("/leaderboard") || p.startsWith("/player/") },
  { href: "/profile", icon: "●", label: "Profil", match: (p: string) => p.startsWith("/profile") || p.startsWith("/admin") },
];

export default function GlobalMobileNav() {
  const pathname = usePathname();
  return (
    <nav className="globalMobileNav" aria-label="Hovedmeny">
      {items.map(item => (
        <a key={item.href} href={item.href} className={item.match(pathname) ? "active" : ""}>
          <span>{item.icon}</span>
          <small>{item.label}</small>
        </a>
      ))}
    </nav>
  );
}
