export type PreEhlBacktestHistory = {
  name: string;
  track: "senior-import" | "norway2-transition" | "junior/talent";
  league: string;
  games: number;
  points?: number;
  savePct?: number;
  gaa?: number;
  source: "EliteProspects";
  note: string;
};

// Verified 2024/25 production for players who entered EHL in 2025/26.
// Regular-season samples are preferred and kept separate from playoffs/qualification.
export const PRE_EHL_BACKTEST_2025: PreEhlBacktestHistory[] = [
  // Senior imports
  { name:"Ryan Lasch", track:"senior-import", league:"Liiga", games:54, points:52, source:"EliteProspects", note:"Pelicans 2024/25 regular season: 13G+39A=52P." },
  { name:"Nick Manuel Caamano", track:"senior-import", league:"DEL", games:35, points:21, source:"EliteProspects", note:"Grizzlys Wolfsburg 2024/25 regular season: 9G+12A=21P." },
  { name:"Blake David McLaughlin", track:"senior-import", league:"AHL", games:15, points:6, source:"EliteProspects", note:"Hartford Wolf Pack 2024/25: 1G+5A=6P." },
  { name:"Blake Douglas Pietila", track:"senior-import", league:"HockeyAllsvenskan", games:27, savePct:0.898, gaa:2.77, source:"EliteProspects", note:"Kalmar HC 2024/25 regular season goaltending." },
  { name:"Trenton Beck Bliss", track:"senior-import", league:"ECHL", games:57, points:42, source:"EliteProspects", note:"Toledo Walleye 2024/25 regular season: 15G+27A=42P." },
  { name:"Teemu Siironen", track:"senior-import", league:"HockeyEttan", games:34, points:41, source:"EliteProspects", note:"Kiruna IF 2024/25 regular season: 20G+21A=41P before joining Nidaros for 2025/26." },
  { name:"Sebastian Kaijser", track:"senior-import", league:"HockeyEttan", games:37, points:42, source:"EliteProspects", note:"IF Sundsvall Hockey 2024/25 regular season: 22G+20A=42P. Qualification games are deliberately excluded." },
  { name:"Jesper Kokkonen", track:"senior-import", league:"HockeyAllsvenskan", games:55, points:12, source:"EliteProspects", note:"Vimmerby HC 2024/25 regular season: 7G+5A=12P. Relegation games are deliberately excluded." },
  { name:"Olle Liss", track:"senior-import", league:"DEL2", games:46, points:35, source:"EliteProspects", note:"Eisbären Regensburg 2024/25 regular season: 19G+16A=35P before joining Storhamar." },
  { name:"Colin Campbell", track:"senior-import", league:"KHL", games:55, points:22, source:"EliteProspects", note:"Kunlun Red Star 2024/25 regular season: 14G+8A=22P before joining Storhamar." },

  // Norway2 -> EHL promotion cohort. This is the key empirical control group for 2026/27 Ringerike pricing.
  { name:"Nils David Hallström", track:"norway2-transition", league:"Norway2", games:32, points:56, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 13G+43A=56P." },
  { name:"Svein Petter Falk-Larssen", track:"norway2-transition", league:"Norway2", games:33, points:47, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 15G+32A=47P." },
  { name:"Mateusz Szurowski", track:"norway2-transition", league:"Norway2", games:35, points:44, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 24G+20A=44P." },
  { name:"Zebastian André Bodini Schmitt", track:"norway2-transition", league:"Norway2", games:34, points:37, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 15G+22A=37P." },
  { name:"Adam Bäckehag", track:"norway2-transition", league:"Norway2", games:33, points:36, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 5G+31A=36P." },
  { name:"Ole Christian Westad Larssen", track:"norway2-transition", league:"Norway2", games:35, points:28, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 15G+13A=28P." },
  { name:"Hugo Niemi", track:"norway2-transition", league:"Norway2", games:34, points:21, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 5G+16A=21P." },
  { name:"Sander Vedul-Kjelsås", track:"norway2-transition", league:"Norway2", games:33, points:20, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 7G+13A=20P." },
  { name:"Mattias Brenne Halvorsen", track:"norway2-transition", league:"Norway2", games:35, points:12, source:"EliteProspects", note:"Nidaros 2024/25 regular season: 3G+9A=12P." },
  { name:"Anders Jonassen", track:"norway2-transition", league:"Norway2", games:41, points:13, source:"EliteProspects", note:"Nidaros 2024/25 overall Norway2 total: 4G+9A=13P. Overall total is used here because the indexed regular-season row was not exposed." },

  // Junior / talent pathway
  { name:"Felix Alexander Kvernstad", track:"junior/talent", league:"Norway U20", games:26, points:21, source:"EliteProspects", note:"Nidaros U20 2024/25: 11G+10A=21P. Also had only a very thin Norway2 senior sample." },
  { name:"Nicolai Evjen", track:"junior/talent", league:"Norway U20", games:29, points:21, source:"EliteProspects", note:"Lillehammer U20 2024/25: 10G+11A=21P." },
];

const norm=(v:string)=>String(v||"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/[^a-z0-9]+/g," ").trim();
export function preEhlBacktestHistoryFor(name:string){return PRE_EHL_BACKTEST_2025.find(x=>norm(x.name)===norm(name))??null}
