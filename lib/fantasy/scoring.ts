export type FantasyPosition = "G" | "D" | "W" | "C";

export type FantasyStatLine = {
  position: FantasyPosition | string;
  didPlay?: boolean | null;
  minutesPlayed?: number | null;
  goals?: number | null;
  assists?: number | null;
  shots?: number | null;
  plusMinus?: number | null;
  pim?: number | null;
  saves?: number | null;
  goalsAgainst?: number | null;
  win?: boolean | null;
  shutout?: boolean | null;
  powerplayGoals?: number | null;
  powerplayAssists?: number | null;
  shorthandedGoals?: number | null;
  shorthandedAssists?: number | null;
  faceoffsWon?: number | null;
  faceoffsTaken?: number | null;
};

export type FantasyScoringConfig = {
  powerplayGoalBonus?: number;
  powerplayAssistBonus?: number;
  shorthandedGoalBonus?: number;
  shorthandedAssistBonus?: number;
  faceoffWinPoints?: number;
  faceoffWinBonus?: number;
};

export type FantasyPointBreakdown = {
  participation: number;
  goals: number;
  assists: number;
  shots: number;
  plusMinus: number;
  pim: number;
  saves: number;
  goalsAgainst: number;
  shutout: number;
  win: number;
  powerplayGoals: number;
  powerplayAssists: number;
  shorthandedGoals: number;
  shorthandedAssists: number;
  faceoffsWon: number;
  faceoffBonus: number;
  total: number;
};

function n(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function calculate19FantasyPoints(
  stat: FantasyStatLine,
  config: FantasyScoringConfig = {},
): FantasyPointBreakdown {
  const position = String(stat.position || "W").toUpperCase() as FantasyPosition;
  const isGoalie = position === "G";
  // HockeyLive does not always expose goalie TOI. Saves/GA are therefore authoritative evidence
  // that a goalie played, while a listed backup with 0 saves, 0 GA and 0:00 gets no points.
  const actuallyPlayed = isGoalie
    ? n(stat.minutesPlayed) > 0 || n(stat.saves) > 0 || n(stat.goalsAgainst) > 0
    : Boolean(stat.didPlay);

  const goalValue = position === "D" || position === "G" ? 15 : 10;
  const assistValue = position === "D" || position === "G" ? 8 : 6;

  const participation = actuallyPlayed ? 2 : 0;
  const goals = n(stat.goals) * goalValue;
  const assists = n(stat.assists) * assistValue;
  const shots = n(stat.shots);
  const plusMinus = n(stat.plusMinus);
  const pim = -Math.min(10, Math.max(0, n(stat.pim)));

  const saves = isGoalie && actuallyPlayed ? n(stat.saves) / 2 : 0;
  const goalsAgainst = isGoalie && actuallyPlayed ? n(stat.goalsAgainst) * -3 : 0;
  const shutout = isGoalie && actuallyPlayed && Boolean(stat.shutout) ? 10 : 0;
  const win = isGoalie && actuallyPlayed && Boolean(stat.win) ? 5 : 0;

  // Special-teams and faceoff rules are deliberately separate from ordinary goal/assist scoring.
  // Their configured values currently default to zero, so introducing these fields cannot change
  // historical totals until an admin explicitly configures a non-zero rule.
  const powerplayGoals = n(stat.powerplayGoals) * n(config.powerplayGoalBonus);
  const powerplayAssists = n(stat.powerplayAssists) * n(config.powerplayAssistBonus);
  const shorthandedGoals = n(stat.shorthandedGoals) * n(config.shorthandedGoalBonus);
  const shorthandedAssists = n(stat.shorthandedAssists) * n(config.shorthandedAssistBonus);
  const faceoffsWon = n(stat.faceoffsWon) * n(config.faceoffWinPoints);
  const faceoffBonus = n(stat.faceoffsWon) > 0 ? n(config.faceoffWinBonus) : 0;

  const total = participation + goals + assists + shots + plusMinus + pim + saves + goalsAgainst + shutout + win
    + powerplayGoals + powerplayAssists + shorthandedGoals + shorthandedAssists + faceoffsWon + faceoffBonus;

  return {
    participation,
    goals,
    assists,
    shots,
    plusMinus,
    pim,
    saves,
    goalsAgainst,
    shutout,
    win,
    powerplayGoals,
    powerplayAssists,
    shorthandedGoals,
    shorthandedAssists,
    faceoffsWon,
    faceoffBonus,
    total,
  };
}
