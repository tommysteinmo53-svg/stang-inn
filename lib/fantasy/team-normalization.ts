function norm(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("nb-NO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const EHL_TEAMS_2026_27 = [
  "Frisk Asker",
  "Lillehammer",
  "Narvik",
  "Nidaros",
  "Ringerike",
  "Sparta",
  "Stavanger",
  "Stjernen",
  "Storhamar",
  "Vålerenga",
] as const;

export type EhlTeam2026 = (typeof EHL_TEAMS_2026_27)[number];

export function canonicalFantasyTeam(value: unknown): string {
  const s = norm(value);
  if (s.includes("storhamar")) return "Storhamar";
  if (s.includes("stavanger") || s.includes("oilers")) return "Stavanger";
  if (s.includes("valerenga") || s.includes("vaalerenga")) return "Vålerenga";
  if (s.includes("frisk")) return "Frisk Asker";
  if (s.includes("sparta")) return "Sparta";
  if (s.includes("narvik")) return "Narvik";
  if (s.includes("stjernen")) return "Stjernen";
  if (s.includes("lillehammer")) return "Lillehammer";
  if (s.includes("ringerike") || s.includes("panthers")) return "Ringerike";
  if (s.includes("nidaros")) return "Nidaros";
  if (s.includes("lorenskog")) return "Lørenskog";
  return String(value ?? "").trim();
}

export function fantasyTeamKey(value: unknown): string {
  return norm(canonicalFantasyTeam(value)).replace(/\s+/g, "");
}

export function isCurrentEhlTeam2026(value: unknown): value is EhlTeam2026 {
  const canonical = canonicalFantasyTeam(value);
  return (EHL_TEAMS_2026_27 as readonly string[]).includes(canonical);
}
