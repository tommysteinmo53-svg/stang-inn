import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const production = readFileSync(new URL("../lib/fantasy/production-import.ts", import.meta.url), "utf8");
const base = readFileSync(new URL("../lib/fantasy/import-service.ts", import.meta.url), "utf8");
const enrichment = readFileSync(new URL("../lib/fantasy/import-enrichment.ts", import.meta.url), "utf8");

test("finished games with nonzero score and zero imported goals are retried", () => {
  assert.match(production, /expectedGoals > 0 && importedGoals === 0/);
  assert.match(production, /complete: !incompleteGoalStats && playedIds\.every/);
});

test("incomplete goal feed blocks base import before player stat writes", () => {
  const guard = base.indexOf("bundle.goals.length < expectedGoals");
  const write = base.indexOf('from("fantasy_player_game_stats").upsert');
  assert.ok(guard >= 0 && write > guard);
});

test("scorer reconciliation blocks unknown scorers before enrichment writes", () => {
  const guard = enrichment.indexOf("eventScoring.unresolvedScorers>0");
  const write = enrichment.indexOf('from("fantasy_player_game_stats").update');
  assert.ok(guard >= 0 && write > guard);
});

test("completed game is not materialized on incomplete goal feed", () => {
  assert.match(production, /imported.sourceRows.goals < expectedGoals/);
  assert.ok(production.indexOf("imported.sourceRows.goals < expectedGoals") < production.indexOf("materializeFantasyPlayerPointsForGame(game.id"));
});
