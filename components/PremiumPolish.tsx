"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function shortTeamName(value: string) {
  return value
    .replace(/\s+IL\s+Ishockeygruppen\s+Elite\s+MEN\s*1?/gi, "")
    .replace(/\s+-\s+MEN\s*1?/gi, "")
    .replace(/\s+Hockey\s*$/gi, "")
    .replace(/\s+Ishockeygruppen\s*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function polishHome() {
  const hero = document.querySelector("main.appShell .heroCard");
  if (!hero) return;

  const heading = hero.querySelector("h2");
  if (heading) {
    heading.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const shortened = shortTeamName(node.textContent);
        if (shortened && shortened !== node.textContent.trim()) node.textContent = ` ${shortened} `;
      }
    });
  }

  const countdownStrong = hero.querySelector<HTMLElement>(".countdown strong");
  const countdownLabel = hero.querySelector<HTMLElement>(".countdown span");
  if (countdownStrong && countdownLabel) {
    const raw = countdownStrong.textContent?.trim() || "";
    const dayMatch = raw.match(/^(\d+)d(?:\s+\d+t)?$/i);
    if (dayMatch) {
      const days = Number(dayMatch[1]);
      countdownStrong.textContent = `${days} ${days === 1 ? "dag" : "dager"}`;
      countdownLabel.textContent = "til kampstart";
    } else if (/^\d+t\s+\d+m$/i.test(raw)) {
      countdownLabel.textContent = "til kampstart";
    }
  }

  const dateLine = hero.querySelector<HTMLElement>(".muted");
  if (dateLine && dateLine.textContent?.includes("tips låses ved kampstart")) {
    dateLine.textContent = dateLine.textContent.replace(" · tips låses ved kampstart", "");
    const h2 = hero.querySelector("h2");
    if (h2 && !hero.querySelector(".premiumRoundMeta")) {
      const meta = document.createElement("div");
      meta.className = "premiumRoundMeta";
      meta.textContent = "EHL · tips låses ved kampstart";
      h2.insertAdjacentElement("afterend", meta);
    }
  }
}

export default function PremiumPolish() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    polishHome();
    const observer = new MutationObserver(polishHome);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setTimeout(polishHome, 250);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
