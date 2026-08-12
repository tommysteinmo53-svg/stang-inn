export type RosterPlayer = {
  personId?: string | number | null;
  name: string;
  team: string;
  position?: string | null;
};

export type PreviousPlayer = RosterPlayer & {
  price?: number | null;
};

function keyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function samePosition(a?: string | null, b?: string | null) {
  if (!a || !b) return true;
  return a.toUpperCase() === b.toUpperCase();
}

export function compareRosters(current: RosterPlayer[], previous: PreviousPlayer[]) {
  const previousById = new Map(previous.filter(p => p.personId != null).map(p => [String(p.personId), p]));
  const previousByName = new Map<string, PreviousPlayer[]>();
  for (const p of previous) {
    const key = keyName(p.name);
    previousByName.set(key, [...(previousByName.get(key) || []), p]);
  }

  const matchedPrevious = new Set<PreviousPlayer>();
  const rows = current.map(player => {
    let old: PreviousPlayer | undefined;
    let match: "personId" | "name" | "new" = "new";

    if (player.personId != null) {
      old = previousById.get(String(player.personId));
      if (old) match = "personId";
    }

    if (!old) {
      const candidates = (previousByName.get(keyName(player.name)) || []).filter(p => samePosition(player.position, p.position));
      if (candidates.length === 1) {
        old = candidates[0];
        match = "name";
      }
    }

    if (old) matchedPrevious.add(old);
    const clubChanged = Boolean(old && keyName(old.team) !== keyName(player.team));

    return {
      ...player,
      previousTeam: old?.team || null,
      previousPrice: old?.price ?? null,
      clubChanged,
      newPlayer: !old,
      match,
    };
  });

  const departed = previous.filter(p => !matchedPrevious.has(p));
  return {
    rows,
    departed,
    summary: {
      current: rows.length,
      matched: rows.filter(r => !r.newPlayer).length,
      newPlayers: rows.filter(r => r.newPlayer).length,
      clubChanges: rows.filter(r => r.clubChanged).length,
      departed: departed.length,
    },
  };
}
