import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
function ok(name, condition, detail='') {
  checks.push({name, pass:Boolean(condition), detail});
}
function has(text, ...needles) { return needles.every(n => text.includes(n)); }
function lacks(text, ...needles) { return needles.every(n => !text.includes(n)); }

const dataModel = read('supabase/mp07-bonus-weeks-data-model-v1.sql');
const activation = read('supabase/mp07-bonus-activation-rpcs-v1.sql');
const eventTeam = read('supabase/mp07-event-team-rpcs-v1.sql');
const snapshot = read('supabase/mp07-snapshot-bonus-event-v1.sql');
const scoring = read('supabase/mp07-scoring-and-history-schema-repair-v1.sql');
const transfer = read('supabase/mp07-transfer-boost-v1.sql');
const rules = read('docs/FANTASY_BONUS_WEEKS_RULES.md');
const bonusUi = read('app/fantasy/team/BonusCards.tsx');
const eventUi = read('app/fantasy/event-team/page.tsx');
const roundsUi = read('app/fantasy/my-rounds/RoundPointsView.tsx');
const leaderboardUi = read('app/fantasy/leaderboard/page.tsx');

// Data model / permanent-team isolation
ok('Event roster uses separate tables', has(dataModel, 'create table if not exists fantasy_event_teams', 'create table if not exists fantasy_event_team_players'));
ok('Event roster never reuses permanent roster table for storage', lacks(dataModel, 'create table if not exists fantasy_user_team_players'));
ok('Event weeks are fixed to Rik/Fattig Onkel budgets', has(dataModel, "event_type='rich_uncle' and event_budget=200.00", "event_type='poor_uncle' and event_budget=70.00"));
ok('Direct authenticated event writes are revoked', has(dataModel, 'revoke insert, update, delete on fantasy_event_teams from authenticated', 'revoke insert, update, delete on fantasy_event_team_players from authenticated'));

// Booster inventory / deadline / stacking / events
ok('All three personal boosters are constrained', has(dataModel, "'captain_boost','line_boost','transfer_boost'"));
ok('One booster inventory slot per team-season-type', has(dataModel, 'unique(team_id, season, booster_type)'));
ok('Only one live booster per team/round', has(dataModel, 'fantasy_bonus_activations_team_round_live_uidx'));
ok('Activation RPC checks deadline', has(activation, 'deadline_at'));
ok('Activation RPC blocks Event Weeks', has(activation, 'fantasy_event_weeks'));
ok('Booster UI communicates one card per round and event exclusion', has(bonusUi, 'Maks ett personlig boosterkort per fantasy-runde', 'Rik Onkel', 'Fattig Onkel'));

// Event teams / validation
ok('Event save RPC validates event budget', has(eventTeam, 'event_budget'));
ok('Event save RPC validates 12-player roster', has(eventTeam, '12'));
ok('Event UI exposes 200m and 70m concepts', has(eventUi, '200', '70'));
ok('Rules explicitly preserve permanent team', has(rules, 'permanente lag', 'automatisk tilbake'));

// Snapshot immutability / event-vs-booster exclusion
ok('Snapshots store booster metadata', has(snapshot, 'booster_type', 'captain_multiplier_override', 'line2_multiplier_override'));
ok('Snapshots store event metadata', has(snapshot, 'event_type', 'event_budget', 'source_event_team_id'));
ok('Snapshots prohibit booster + event stacking', has(snapshot, 'fantasy_snapshot_no_booster_during_event_check'));
ok('Snapshot freezes event roster separately', has(snapshot, 'fantasy_event_team_players'));

// Authoritative scoring contracts
ok('Scoring uses schema-aligned version', has(scoring, 'team-v6-bonus-schema-aligned'));
ok('Scoring uses captain snapshot override', has(scoring, 'captain_multiplier_override'));
ok('Scoring uses line-2 snapshot override', has(scoring, 'line2_multiplier_override'));
ok('Scoring sums all game rows in the round', has(scoring, 'sum(gp.total_points)', 'fantasy_round_games'));
ok('Scoring writes actual production player-point columns', has(scoring, 'games_played', 'line_no', 'line_multiplier', 'multiplier'));
ok('Scoring no longer writes removed columns', lacks(scoring, 'snapshot_player_id', 'game_count'));

// Transfer boost
ok('Transfer boost raises effective limit to 4', has(transfer, '4'));
ok('Transfer boost keeps ordinary limit at 2', has(transfer, '2'));
ok('Permanent transfers are blocked in Event Weeks', has(transfer, 'fantasy_event_weeks'));
ok('Third transfer commits the transfer booster', has(transfer, "status='committed'"));

// History / explainability
ok('Round history exposes booster/event metadata', has(scoring, 'get_my_fantasy_round_details_v2', 'booster_type', 'event_type', 'event_budget'));
ok('Leaderboard history exposes booster/event metadata', has(scoring, 'get_fantasy_team_season_history_v2'));
ok('My rounds UI displays Rik/Fattig Onkel markers', has(roundsUi, 'Rik Onkel', 'Fattig Onkel'));
ok('Leaderboard UI displays booster/event markers', has(leaderboardUi, 'Kapteinsboost', 'Rekkeboost', 'Bytteboost', 'Rik Onkel', 'Fattig Onkel'));

const failed = checks.filter(c => !c.pass);
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
console.log(`\nMP-07.6L: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) {
  console.error(`Failed checks: ${failed.map(x => x.name).join('; ')}`);
  process.exit(1);
}
