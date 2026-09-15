/** Active participants are independent of the pending 40/48-game season format. */
export const EHL_SEASON = "2026/27";
export const EHL_ACTIVE_TEAMS = [
  "Storhamar", "Oilers", "Vålerenga", "Frisk Asker", "Narvik",
  "Stjernen", "Lillehammer", "Nidaros", "Ringerike",
];

const withdrawnAliases = new Set([
  "sparta", "sparta elite", "sparta sarpsborg", "sparta ishockey elite",
  "sparta ishockey elite, il - ishockey",
]);

export function isWithdrawnEhlTeam(season: string, team: string) {
  return season === EHL_SEASON && withdrawnAliases.has(team.trim().toLocaleLowerCase("nb-NO"));
}

export function isWithdrawnEhlMatch(season: string, home: string, away: string) {
  return isWithdrawnEhlTeam(season, home) || isWithdrawnEhlTeam(season, away);
}
