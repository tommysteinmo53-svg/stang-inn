export type PreEhlBacktestHistory = {
  name: string;
  track: "senior-import" | "junior/talent";
  league: string;
  games: number;
  points?: number;
  savePct?: number;
  gaa?: number;
  source: "EliteProspects";
  note: string;
};

// Verified 2024/25 production for players who entered EHL in 2025/26.
// Keep regular-season samples separate from playoffs so league translation is comparable.
export const PRE_EHL_BACKTEST_2025: PreEhlBacktestHistory[] = [
  { name:"Ryan Lasch", track:"senior-import", league:"Liiga", games:54, points:52, source:"EliteProspects", note:"Pelicans 2024/25 regular season: 13G+39A=52P." },
  { name:"Nick Manuel Caamano", track:"senior-import", league:"DEL", games:35, points:21, source:"EliteProspects", note:"Grizzlys Wolfsburg 2024/25 regular season: 9G+12A=21P." },
  { name:"Blake David McLaughlin", track:"senior-import", league:"AHL", games:15, points:6, source:"EliteProspects", note:"Hartford Wolf Pack 2024/25: 1G+5A=6P." },
  { name:"Blake Douglas Pietila", track:"senior-import", league:"HockeyAllsvenskan", games:27, savePct:0.898, gaa:2.77, source:"EliteProspects", note:"Kalmar HC 2024/25 regular season goaltending." },
  { name:"Trenton Beck Bliss", track:"senior-import", league:"ECHL", games:57, points:42, source:"EliteProspects", note:"Toledo Walleye 2024/25 regular season: 15G+27A=42P." },
  { name:"Felix Alexander Kvernstad", track:"junior/talent", league:"Norway U20", games:26, points:21, source:"EliteProspects", note:"Nidaros U20 2024/25: 11G+10A=21P. Also had only a very thin Norway2 senior sample." },
  { name:"Nicolai Evjen", track:"junior/talent", league:"Norway U20", games:29, points:21, source:"EliteProspects", note:"Lillehammer U20 2024/25: 10G+11A=21P." },
];

const norm=(v:string)=>String(v||"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
export function preEhlBacktestHistoryFor(name:string){return PRE_EHL_BACKTEST_2025.find(x=>norm(x.name)===norm(name))??null}
