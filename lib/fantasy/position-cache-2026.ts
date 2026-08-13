export type FantasyPosition = "G" | "D" | "C" | "W";

export type CachedPosition = {
  position: FantasyPosition;
  source: "EliteProspects" | "Manual";
  sourceNote?: string;
};

// Versioned 2026/27 position cache. HockeyLive remains the roster source of truth;
// this file only fills missing fantasy positions with externally/manual verified positions.
// Forward-only EP positions (F/LW/RW) are mapped to fantasy W; C/* keeps C.
export const POSITION_CACHE_2026: Record<string, CachedPosition> = {
  "Alexander Anderberg": { position: "D", source: "EliteProspects" },
  "Charles Francis Callaghan": { position: "D", source: "EliteProspects", sourceNote: "EP player 504241: Charlie Callaghan (D), Frisk Asker 2026/27" },
  "Gustavs Arnis": { position: "G", source: "EliteProspects" },
  "Sebastian Dyk": { position: "W", source: "EliteProspects", sourceNote: "EP: F" },

  "Adam Isac Bäckstrand": { position: "C", source: "EliteProspects", sourceNote: "EP: Adam Bäckstrand (C/RW)" },
  "Erlend Sletmoe-Kjærnet": { position: "D", source: "EliteProspects" },
  "Mathias Despotovic Kristiansen": { position: "D", source: "EliteProspects" },
  "Niilo Ensio Halonen": { position: "G", source: "EliteProspects", sourceNote: "EP: Niilo Halonen (G)" },
  "Oliver Tufte Langland": { position: "W", source: "EliteProspects", sourceNote: "EP: RW" },
  "Viljami Arvid Juusola": { position: "D", source: "EliteProspects", sourceNote: "EP: Viljami Juusola (D)" },

  "Anton Karl Yngve Hjalmarsson": { position: "G", source: "EliteProspects", sourceNote: "EP: Anton Hjalmarsson (G)" },
  "Isak Anders Samuel Pantzare": { position: "D", source: "EliteProspects", sourceNote: "EP: Isak Pantzare (D)" },
  "Sondre Berg": { position: "D", source: "EliteProspects", sourceNote: "EP player 980839: D" },

  "Alieu Moldal Bah": { position: "W", source: "EliteProspects", sourceNote: "EP: RW" },
  "Daniel Lebedeff": { position: "G", source: "EliteProspects" },
  "Jack Avery York": { position: "D", source: "EliteProspects", sourceNote: "EP: Jack York (D)" },

  "Isac Elias Farmen Andersen": { position: "W", source: "Manual", sourceNote: "Manuelt verifisert: wing" },
  "Iver Wick Karlsen": { position: "W", source: "EliteProspects", sourceNote: "EP: F" },
  "Jørgen Rønning": { position: "G", source: "EliteProspects" },
  "Kim Robin Bjørnstad": { position: "D", source: "EliteProspects", sourceNote: "EP: Robin Bjørnstad (D)" },
  "Lars Ludvig Alexius Hedström": { position: "D", source: "EliteProspects", sourceNote: "EP player 344853: Ludvig Hedström (D), Ringerike 2026/27" },
  "Ludvik Kind Bakkevig": { position: "W", source: "EliteProspects", sourceNote: "EP: F" },
  "Neil John David Beaton": { position: "C", source: "EliteProspects", sourceNote: "EP player 300798: John Beaton (C), Ringerike 2026/27" },
  "Thomas Lyngaas Higson": { position: "D", source: "EliteProspects" },
  "Victor Slettebråten Karadas": { position: "D", source: "EliteProspects" },
  "Viktor Natanael Lundseie Lindholm": { position: "C", source: "EliteProspects", sourceNote: "EP: Natanael Lindholm (C/RW)" },

  "Anton Gradin": { position: "W", source: "EliteProspects", sourceNote: "EP: RW/LW" },
  "Jonas Nyhus Myhre": { position: "D", source: "EliteProspects" },
  "Markus Walberg": { position: "G", source: "EliteProspects", sourceNote: "EP: Marcus Walberg (G)" },
  "Martin Grönberg": { position: "C", source: "EliteProspects", sourceNote: "EP: C/LW" },
  "Niks Fenenko": { position: "D", source: "EliteProspects" },
  "Rasmus Olsen Brekke": { position: "W", source: "EliteProspects", sourceNote: "EP: F" },

  "Case McCarthy": { position: "D", source: "EliteProspects" },
  "Isak Hansen": { position: "D", source: "EliteProspects" },
  "Jonas Eide Pettersen": { position: "D", source: "EliteProspects" },
  "Zachary Émond": { position: "G", source: "EliteProspects" },

  "Evald Lukas Rhodin": { position: "D", source: "EliteProspects", sourceNote: "EP: Lukas Rhodin (D)" },
  "Faustas Nauseda": { position: "G", source: "EliteProspects" },
  "Kalle Falch Grotnes": { position: "G", source: "EliteProspects" },
  "Theodor Flåm": { position: "G", source: "EliteProspects" },

  "Tyler Parks": { position: "G", source: "EliteProspects" },

  "Juuso Vainio": { position: "D", source: "EliteProspects" },
  "Kristoffer Gunnarsson": { position: "D", source: "EliteProspects" },
  "Lars Volden": { position: "G", source: "EliteProspects" },
  "Pathrik Westerholm": { position: "C", source: "EliteProspects" },
};
