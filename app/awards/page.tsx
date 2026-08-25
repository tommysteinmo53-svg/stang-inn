"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import SIIcon, { type SIIconName } from "../../components/SIIcon";

type Player = { id: string; display_name: string };
type Match = { id: number; home_team: string; away_team: string; home_score: number | null; away_score: number | null; finished: boolean; round: number | null; match_time: string | null };
type Tip = { player_id: string; match_id: number; home_tip: number; away_tip: number; points: number | null };
type Award = { icon: SIIconName; title: string; player: Player | null; value: string; detail: string };
type Miss = { p: Player; distance: number; match: Match; tip: Tip };

const isFinal = (match: Match) => match.finished && match.home_score !== null && match.away_score !== null;
const outcome = (home: number, away: number) => (home > away ? "H" : home < away ? "A" : "D");
const isExact = (match: Match, tip: Tip) => match.home_score !== null && match.away_score !== null && tip.home_tip === match.home_score && tip.away_tip === match.away_score;
const isCorrectOutcome = (match: Match, tip: Tip) => match.home_score !== null && match.away_score !== null && outcome(tip.home_tip, tip.away_tip) === outcome(match.home_score, match.away_score);

function monthKey(value: string | null) { if (!value) return null; const date = new Date(value); if (Number.isNaN(date.getTime())) return null; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function monthIsClosed(key: string, now = new Date()) { const [year, month] = key.split("-").map(Number); return new Date(year, month, 1).getTime() <= now.getTime(); }
function monthLabel(key: string) { const [year, month] = key.split("-").map(Number); const label = new Intl.DateTimeFormat("no-NO", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1, 12)); return label.charAt(0).toUpperCase() + label.slice(1); }
function missDistance(match: Match, tip: Tip) { return Math.abs(tip.home_tip - match.home_score!) + Math.abs(tip.away_tip - match.away_score!); }

function AwardCard({ award, variant = "standard" }: { award: Award; variant?: "featured" | "standard" | "miss" }) {
  return <article className={`awardCard awardCardPolished ${variant} ${award.player ? "hasWinner" : "pendingAward"}`}>
    <div className="awardCardTop"><div className="awardIcon"><SIIcon name={award.icon} size={38}/></div><span className="awardState">{award.player ? "Kåret" : "Venter"}</span></div>
    <p className="eyebrow">{award.title}</p>
    <h2>{award.player?.display_name || "Ikke kåret ennå"}</h2>
    <strong>{award.value}</strong>
    <p className="muted awardDetail">{award.detail}</p>
    {award.player && <a href={`/player/${award.player.id}`}>Se spillerprofil →</a>}
  </article>;
}

export default function AwardsPage() {
  const [players, setPlayers] = useState<Player[]>([]), [matches, setMatches] = useState<Match[]>([]), [tips, setTips] = useState<Tip[]>([]), [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { const supabase = getSupabaseBrowserClient(); if (!supabase) { setLoading(false); return; } const [playerResult, matchResult, tipResult] = await Promise.all([supabase.from("players").select("id,display_name"), supabase.from("matches").select("id,home_team,away_team,home_score,away_score,finished,round,match_time").order("match_time"), supabase.from("tips").select("player_id,match_id,home_tip,away_tip,points")]); setPlayers((playerResult.data || []) as Player[]); setMatches((matchResult.data || []) as Match[]); setTips((tipResult.data || []) as Tip[]); setLoading(false); })(); }, []);

  const data = useMemo(() => {
    const finished = matches.filter(isFinal), matchMap = new Map(finished.map((match) => [match.id, match])), finishedIds = new Set(finished.map((match) => match.id));
    const scored = tips.filter((tip) => finishedIds.has(tip.match_id) && tip.points !== null), finishedTips = tips.filter((tip) => finishedIds.has(tip.match_id));
    const pointsFor = (tip: Tip) => Number(tip.points ?? 0);
    const summarize = (player: Player, rows: Tip[]) => { let exact = 0, correct = 0, points = 0; for (const tip of rows) { const match = matchMap.get(tip.match_id); if (!match) continue; points += pointsFor(tip); if (isExact(match, tip)) exact += 1; else if (isCorrectOutcome(match, tip)) correct += 1; } return { p: player, points, exact, correct, tipped: rows.length }; };
    const byPlayer = players.map((player) => summarize(player, scored.filter((tip) => tip.player_id === player.id)));
    const sniper = scored.length ? [...byPlayer].sort((a,b)=>b.exact-a.exact||b.points-a.points||b.correct-a.correct||a.p.display_name.localeCompare(b.p.display_name,"no"))[0] : null;
    const expertMinTips = finished.length ? Math.max(1, Math.ceil(finished.length * 0.75)) : 0;
    const expert = expertMinTips ? byPlayer.filter((row)=>row.tipped>=expertMinTips).map((row)=>({...row,hitRate:(row.exact+row.correct)/row.tipped})).sort((a,b)=>b.hitRate-a.hitRate||b.exact-a.exact||b.points-a.points||b.correct-a.correct||a.p.display_name.localeCompare(b.p.display_name,"no"))[0] || null : null;
    let streak:{p:Player;n:number}|null=null; if(scored.length){for(const player of players){let current=0,best=0;for(const match of [...finished].sort((a,b)=>(a.match_time||"").localeCompare(b.match_time||""))){const tip=scored.find((candidate)=>candidate.player_id===player.id&&candidate.match_id===match.id);if(tip&&pointsFor(tip)>0){current+=1;best=Math.max(best,current)}else current=0}if(best>0&&(!streak||best>streak.n))streak={p:player,n:best}}}
    const roundNumbers=[...new Set(matches.map((match)=>match.round).filter((round):round is number=>round!==null))].sort((a,b)=>a-b); const completedRounds=roundNumbers.filter((round)=>{const roundMatches=matches.filter((match)=>match.round===round);return roundMatches.length>0&&roundMatches.every(isFinal)}); const latestRound=completedRounds.at(-1);
    let roundWinner:ReturnType<typeof summarize>|null=null; if(latestRound!==undefined){const roundIds=new Set(finished.filter((match)=>match.round===latestRound).map((match)=>match.id));roundWinner=players.map((player)=>summarize(player,scored.filter((tip)=>tip.player_id===player.id&&roundIds.has(tip.match_id)))).sort((a,b)=>b.points-a.points||b.exact-a.exact||b.correct-a.correct||a.p.display_name.localeCompare(b.p.display_name,"no")).find((row)=>row.tipped>0)||null}
    const closedScoredMonths=[...new Set(scored.map((tip)=>monthKey(matchMap.get(tip.match_id)?.match_time||null)).filter((key):key is string=>key!==null&&monthIsClosed(key)))].sort(); const latestClosedMonth=closedScoredMonths.at(-1); let monthlyWinner:ReturnType<typeof summarize>|null=null; if(latestClosedMonth){const monthIds=new Set(finished.filter((match)=>monthKey(match.match_time)===latestClosedMonth).map((match)=>match.id));monthlyWinner=players.map((player)=>summarize(player,scored.filter((tip)=>tip.player_id===player.id&&monthIds.has(tip.match_id)))).filter((row)=>row.tipped>0).sort((a,b)=>b.points-a.points||b.exact-a.exact||b.correct-a.correct||a.p.display_name.localeCompare(b.p.display_name,"no"))[0]||null}
    const chooseMiss=(rows:Tip[]):Miss|null=>{const candidates=rows.map((tip)=>{const match=matchMap.get(tip.match_id),player=players.find((candidate)=>candidate.id===tip.player_id);return match&&player?{p:player,distance:missDistance(match,tip),match,tip}:null}).filter((row):row is Miss=>row!==null);return candidates.sort((a,b)=>b.distance-a.distance||(a.match.match_time||"").localeCompare(b.match.match_time||"")||a.p.display_name.localeCompare(b.p.display_name,"no")||a.match.id-b.match.id)[0]||null};
    const weeklyRoundIds=latestRound===undefined?new Set<number>():new Set(finished.filter((match)=>match.round===latestRound).map((match)=>match.id)); const weeklyMiss=latestRound===undefined?null:chooseMiss(finishedTips.filter((tip)=>weeklyRoundIds.has(tip.match_id))); const seasonMiss=chooseMiss(finishedTips);
    return [
      {icon:"trophy",title:"Rundevinner",player:roundWinner?.p||null,value:roundWinner?`${roundWinner.points} poeng`:"–",detail:latestRound!==undefined?`Runde ${latestRound}`:"Ingen ferdigspilte runder"},
      {icon:"calendar",title:"Månedsvinner",player:monthlyWinner?.p||null,value:monthlyWinner?`${monthlyWinner.points} poeng`:"–",detail:latestClosedMonth?monthLabel(latestClosedMonth):"Kåres etter første avsluttede kalendermåned med scorede tips"},
      {icon:"achievement",title:"Eksperttittel",player:expert?.p||null,value:expert?`${Math.round(expert.hitRate*100)} % treff`:"–",detail:expertMinTips?`Høyest treffprosent blant spillere med minst ${expertMinTips} av ${finished.length} ferdigspilte kamper tippet`:"Kåres når første kamp er ferdigspilt"},
      {icon:"tips",title:"Sniper",player:sniper?.p||null,value:sniper?`${sniper.exact} eksakte`:"–",detail:"Flest eksakte tips denne sesongen"},
      {icon:"stats",title:"Beste streak",player:streak?.p||null,value:streak?`${streak.n} på rad`:"–",detail:"Lengste rekke med poenggivende tips"},
      {icon:"event",title:"Ukens bom",player:weeklyMiss?.p||null,value:weeklyMiss?`${weeklyMiss.tip.home_tip}–${weeklyMiss.tip.away_tip}`:"–",detail:weeklyMiss?`Runde ${latestRound}: ${weeklyMiss.match.home_team}–${weeklyMiss.match.away_team} endte ${weeklyMiss.match.home_score}–${weeklyMiss.match.away_score}`:"Kåres etter siste ferdigspilte runde"},
      {icon:"transfer",title:"Sesongens bom",player:seasonMiss?.p||null,value:seasonMiss?`${seasonMiss.tip.home_tip}–${seasonMiss.tip.away_tip}`:"–",detail:seasonMiss?`${seasonMiss.match.home_team}–${seasonMiss.match.away_team} endte ${seasonMiss.match.home_score}–${seasonMiss.match.away_score}`:"Ingen ferdige kamper"},
    ] as Award[];
  }, [players,matches,tips]);

  const featured=data.slice(0,3), performance=data.slice(3,5), misses=data.slice(5);
  const awardedCount=data.filter((award)=>award.player).length;
  if(loading)return <main className="appShell"><p className="muted">Laster awards …</p></main>;

  return <main className="appShell awardsPage"><header className="topbar"><a href="/" className="brand brandButton" style={{textDecoration:"none"}}><div className="brandMark"><SIIcon name="trophy" size={32}/></div><div><p className="eyebrow">Hall of fame</p><h1>Awards</h1></div></a><a href="/" className="textButton">← Hjem</a></header>
    <section className="pageStack awardsStack"><article className="heroCard awardsHero"><div><p className="eyebrow">Prestasjoner</p><h2>Sesongens kåringer</h2><p className="muted">Rundevinnere, eksperter, streaks og de største bommene – automatisk basert på faktiske tippingresultater.</p></div><div className="countdown"><strong>{awardedCount}/7</strong><span>kåringer aktive</span></div></article>
      <div className="awardsSectionHeading"><div><p className="eyebrow">Hovedkåringer</p><h3>Runde, måned og ekspert</h3></div></div><section className="awardsFeaturedGrid">{featured.map((award)=><AwardCard key={award.title} award={award} variant="featured"/>)}</section>
      <div className="awardsSectionHeading"><div><p className="eyebrow">Prestasjon</p><h3>Presisjon og form</h3></div></div><section className="awardsPerformanceGrid">{performance.map((award)=><AwardCard key={award.title} award={award}/>)}</section>
      <div className="awardsSectionHeading missHeading"><div><p className="eyebrow">På den andre siden …</p><h3>Bomkåringene</h3></div><span className="statusPill"><SIIcon name="event" size={18}/> Hederlig omtale</span></div><section className="awardsMissGrid">{misses.map((award)=><AwardCard key={award.title} award={award} variant="miss"/>)}</section>
      <article className="panel awardsRules"><div className="panelHeading"><div><p className="eyebrow">Slik fungerer det</p><h3>Kåringene følger faktiske resultater</h3></div><span className="statusPill">Automatisk</span></div><div className="awardsRuleGrid"><div><strong><SIIcon name="calendar" size={22}/> Månedsvinner</strong><span>Kåres først når kalendermåneden er avsluttet.</span></div><div><strong><SIIcon name="achievement" size={22}/> Eksperttittel</strong><span>Krever tips på minst 75 % av ferdigspilte kamper.</span></div><div><strong><SIIcon name="event" size={22}/> Ukens bom</strong><span>Bruker kun siste fullførte EHL-runde.</span></div></div><p className="muted awardsEngineNote">Poengbaserte kåringer bruker kun poeng scoret av den autoritative tippingmotoren.</p></article>
    </section>
  </main>;
}
