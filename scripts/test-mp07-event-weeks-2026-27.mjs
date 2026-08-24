import fs from "node:fs";

const migration=fs.readFileSync("supabase/mp07-event-weeks-2026-27-final.sql","utf8");
const transfer=fs.readFileSync("supabase/mp07-transfer-boost-v1.sql","utf8");
const boosters=fs.readFileSync("supabase/mp07-bonus-activation-rpcs-v1.sql","utf8");
const scoring=fs.readFileSync("supabase/mp07-scoring-and-history-schema-repair-v1.sql","utf8");
const rounds=fs.readFileSync("app/fantasy/rounds/page.tsx","utf8");
const bonusUi=fs.readFileSync("app/fantasy/team/BonusCards.tsx","utf8");
const eventUi=fs.readFileSync("app/fantasy/event-team/page.tsx","utf8");
const history=fs.readFileSync("app/fantasy/my-rounds/RoundPointsView.tsx","utf8");
const leaderboard=fs.readFileSync("app/fantasy/leaderboard/page.tsx","utf8");
const rules=fs.readFileSync("app/fantasy/rules/page.tsx","utf8");

const checks=[
 [migration.includes("round_no=15")&&migration.includes("'rich_uncle',200.00")&&migration.includes("2026-11-12 17:30:00+00"),"GW15 must be Rich Uncle 200m on authoritative deadline"],
 [migration.includes("round_no=22")&&migration.includes("'christmas_party',null")&&migration.includes("2026-12-03 17:30:00+00"),"GW22 must be Julebord on authoritative deadline"],
 [migration.includes("round_no=38")&&migration.includes("'poor_uncle',70.00")&&migration.includes("2027-02-18 17:00:00+00"),"GW38 must be Poor Uncle 70m on authoritative deadline"],
 [migration.includes("v_event.event_type in ('rich_uncle','poor_uncle')")&&migration.includes("fantasy_event_team_players"),"Rich/Poor must freeze separate event roster"],
 [migration.includes("v_event.event_type='christmas_party'")&&migration.includes("v_line2_override:=1.00")&&migration.includes("v_cap_override:=null"),"Julebord must freeze permanent roster with line2 100% and normal captain"],
 [migration.includes("event_type='christmas_party' and event_budget is null and source_event_team_id is null"),"Julebord snapshot must not reference a separate event team"],
 [scoring.includes("line2_multiplier_override")&&scoring.includes("captain_multiplier_override")&&scoring.includes("vice_captain_multiplier"),"scoring must consume immutable snapshot overrides while retaining season C/VC rules"],
 [boosters.includes("from fantasy_event_weeks")&&boosters.includes("Personal boosters cannot be used in an Event Week"),"server must block personal boosters in every configured Event Week"],
 [transfer.includes("from fantasy_event_weeks")&&transfer.includes("Permanent transfers are disabled during an Event Week"),"server must block permanent transfers in every configured Event Week"],
 [migration.includes("get_fantasy_event_schedule_v1")&&migration.includes("auth.uid() is null")&&migration.includes("from public,anon")&&migration.includes("to authenticated"),"Event schedule read model must be authenticated-only"],
 [rounds.includes("get_fantasy_event_schedule_v1")&&rounds.includes("Julebord · begge rekker 100 %")&&rounds.includes("Rik Onkel · 200m")&&rounds.includes("Fattig Onkel · 70m"),"round calendar must identify all three Event Weeks"],
 [bonusUi.includes("eventRoundIds")&&bonusUi.includes("!eventRoundIds.has(r.id)")&&bonusUi.includes("Rik Onkel, Julebord eller Fattig Onkel"),"booster picker must remove all Event Weeks"],
 [eventUi.includes('type EventType="rich_uncle"|"poor_uncle"'),"separate Eventlag builder must remain limited to Rich/Poor Uncle"],
 [history.includes('v==="christmas_party"')&&history.includes("ALLE SKAL MED")&&history.includes("begge rekker telte 100 %"),"snapshot round history must explain Julebord"],
 [leaderboard.includes('h.event_type==="christmas_party"')&&leaderboard.includes("Julebord · Alle skal med!"),"leaderboard round history must label Julebord"],
 [rules.includes("GW15 · Rik Onkel")&&rules.includes("GW22 · Julebord")&&rules.includes("GW38 · Fattig Onkel")&&rules.includes("Kaptein er fortsatt ×2 og visekaptein ×1,5"),"public rules must explain the final Event Week schedule"],
 [migration.includes("Refusing Event Week configuration after snapshots already exist")&&migration.includes("Refusing Event Week configuration after scoring already exists"),"production configuration must refuse historical rewrite"],
];
let failed=0;
for(const[ok,msg]of checks){console.log(`${ok?"PASS":"FAIL"} ${msg}`);if(!ok)failed++}
if(failed)process.exit(1);
