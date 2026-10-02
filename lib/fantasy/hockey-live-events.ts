import type { NifMatchBundle } from "./nif-client";

// Public read-only subscription used by live.hockey.no. No publish credentials.
const HISTORY = "https://ps.pndsn.com/v2/history/sub-key/sub-c-c2d2cfc6-f753-11e6-80ea-0619f8945a4f/channel/";
type Event = Record<string, any>;
type Message = { message: Event; timetoken: string };
type State = { cursor: string; events: Map<string, Event>; checkedAt: number; complete: boolean };
const states = new Map<number, State>();
const pending = new Map<number, Promise<Event[]>>();

export function applyLiveMessages(events: Map<string, Event>, messages: Message[], matchId: number) {
  for (const { message: event, timetoken } of messages) {
    if (Number(event.MatchId) !== matchId) continue;
    const key = event.MatchEventType === "MatchData" ? "__MatchData" : event.ClientId;
    if (!key) continue;
    if (event.MatchEventType === "Delete") events.delete(String(event.DeletedEventClientId));
    else events.set(String(key), { ...event, TimeToken: String(timetoken) });
  }
}

async function readEvents(matchId: number): Promise<Event[]> {
  if (!Number.isSafeInteger(matchId) || matchId <= 0) throw new Error("Invalid match ID");
  const previous = states.get(matchId);
  if (previous?.complete && Date.now() - previous.checkedAt < 25000) return [...previous.events.values()];
  const events = new Map(previous?.events), started = Date.now();
  let cursor = previous?.cursor ?? "0";
  // Corrections/deletions arrive as new messages. Resume from the last committed cursor.
  for (let page = 0; page < 100; page++) {
    const remaining = 45000 - (Date.now() - started);
    if (remaining <= 0) throw new Error("Live history timed out before reaching its end");
    const response = await fetch(`${HISTORY}${encodeURIComponent(`match:${matchId}:all`)}?count=100&reverse=true&include_token=true&string_message_token=true&uuid=stang-inn-live&start=${cursor}`,
      { cache: "no-store", signal: AbortSignal.timeout(Math.min(20000, remaining)) });
    if (!response.ok) throw new Error(`Live history HTTP ${response.status}`);
    // History boundary tokens may still be JSON integers exceeding JS safe precision.
    const body = (await response.text()).replace(/([[:,]\s*)(\d{16,})(?=\s*[,}\]])/g, '$1"$2"');
    const data = JSON.parse(body);
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("Invalid live history response");
    const messages = data[0] as Message[];
    applyLiveMessages(events, messages, matchId);
    const next = String(data[2]);
    if (messages.length && (!/^\d+$/.test(next) || BigInt(next) <= BigInt(cursor))) throw new Error("Live history cursor did not advance");
    if (messages.length) cursor = next;
    states.set(matchId, { events: new Map(events), cursor, checkedAt: Date.now(), complete: messages.length < 100 });
    if (messages.length < 100) {
      for (const [id, state] of states) if (Date.now() - state.checkedAt > 12 * 3600000) states.delete(id);
      states.set(matchId, { events, cursor, checkedAt: Date.now(), complete: true });
      return [...events.values()];
    }
  }
  throw new Error("Live history incomplete: page limit reached");
}

export function fetchHockeyLiveEvents(matchId: number): Promise<Event[]> {
  const existing = pending.get(matchId);
  if (existing) return existing;
  const request = readEvents(matchId).finally(() => pending.delete(matchId));
  pending.set(matchId, request);
  return request;
}

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const seconds = (value: unknown) => {
  const parts = String(value ?? "").match(/^(\d+):(\d{2})$/);
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : 0;
};
/** Convert the resolved public event stream into the existing scoring input. */
export function liveEventsBundle(matchId: number, events: Event[]): NifMatchBundle {
  const metadata = events.filter(e => e.MatchEventType === "MatchData")
    .sort((a,b) => String(b.TimeToken).localeCompare(String(a.TimeToken)))[0];
  if (!metadata || !Array.isArray(metadata.HomePlayers) || !Array.isArray(metadata.AwayPlayers)
    || !Array.isArray(metadata.HomeGoalies) || !Array.isArray(metadata.AwayGoalies)) throw new Error("Live roster unavailable");
  const players = [...metadata.HomePlayers, ...metadata.AwayPlayers].map(p => ({ personId: p.Id,
    goalsScored: 0, assists: 0, shots: 0, pim: 0, playerTime: 0, playerTimeSeconds: 0, faceoffsWon: 0, faceoffsTaken: 0 }));
  const goalies = [...metadata.HomeGoalies, ...metadata.AwayGoalies].map(p => ({ personId: p.Id,
    saves: 0, goalsAgainst: 0, playerTimeSeconds: 0, goalsScored: 0, assists: 0, pim: 0 }));
  const skaters = new Map(players.map(p => [String(p.personId), p]));
  const keepers = new Map(goalies.map(p => [String(p.personId), p]));
  const goals: Event[] = [];
  const elapsed = Math.max(0, ...events.map(e => seconds(e.TotalMatchTime)));
  const types: Record<number, string> = { 200141: "Even strength", 200142: "Powerplay", 200143: "Powerplay", 200144: "Shorthanded", 200145: "Shorthanded", 200150: "Penalty shot" };
  let shootout = false;
  for (const event of events) {
    const type = event.MatchEventType, p = skaters.get(String(event.Player)), keeper = keepers.get(String(event.Goalie));
    if (type === "Shootout" || /shootout|straffeslag/i.test(String(event.PeriodName))) { shootout = true; continue; }
    const goal = type === "Goal" || (type === "PenaltyShot" && event.ResultText === "Goal");
    if (goal) {
      if (event.Team !== "H" && event.Team !== "A") throw new Error("Unresolved live goal side");
      if (p) { p.goalsScored++; p.shots++; }
      else { const scorer = keepers.get(String(event.Player)); if (scorer) scorer.goalsScored++; }
      for (const id of new Set([event.FirstAssist, event.SecondAssist].filter(Boolean))) {
        const assist = skaters.get(String(id)) ?? keepers.get(String(id));
        if (assist) assist.assists++;
      }
      if (keeper && !event.EmptyNet) keeper.goalsAgainst++;
      const active = Array.isArray(event.ActivePlayers) ? event.ActivePlayers : [];
      const opponents = Array.isArray(event.Opponents) ? event.Opponents : [];
      goals.push({ personId: event.Player, homeOrAwayTeam: event.Team, goalType: types[event.GoalType] ?? "Unknown",
        firstAssistPersonId: event.FirstAssist, secondAssistPersonId: event.SecondAssist,
        penaltyShot: type === "PenaltyShot", periodName: event.PeriodName,
        onIceHomeTeamPersonIDs: event.Team === "H" ? active : opponents,
        onIceAwayTeamPersonIDs: event.Team === "A" ? active : opponents });
    } else if (type === "Shot" || type === "PenaltyShot") {
      if (p) p.shots++;
      if (keeper) keeper.saves++;
    } else if (type === "Penalty") {
      const penalized = p ?? keepers.get(String(event.Player));
      if (penalized) penalized.pim += number(event.Minutes);
    } else if (type === "Faceoff") {
      if (p) { p.faceoffsWon++; p.faceoffsTaken++; }
      const opponent = skaters.get(String(event.Opponent));
      if (opponent) opponent.faceoffsTaken++;
    }
  }
  // Only recorded time is used; never infer participation from the scheduled clock.
  for (const p of [...players, ...goalies]) {
    const changes = events.filter(e => e.MatchEventType === "PlayerTime" && String(e.Player) === String(p.personId))
      .sort((a,b) => seconds(a.TotalMatchTime)-seconds(b.TotalMatchTime) || String(a.TimeToken).localeCompare(String(b.TimeToken)));
    let since: number | null = null, played = 0;
    for (const e of changes) {
      if (number(e.Direction) === 1 && since === null) since = seconds(e.TotalMatchTime);
      else if (number(e.Direction) === 2 && since !== null) { played += Math.max(0, seconds(e.TotalMatchTime)-since); since = null; }
    }
    if (since !== null) played += Math.max(0, elapsed-since);
    p.playerTimeSeconds = played;
  }
  return { matchId, players, goalies, goals, penalties: [], teamMembers: [], tournamentPlayers: [],
    liveStarted: events.some(e => e.MatchEventType === "Timer" && number(e.Type) === 4), liveScoreUnavailable: shootout,
    availability: { players: true, goalies: true, goals: true, penalties: true, teamMembers: true } };
}
