"use client";

import styles from "./HomeTippingCoupon.module.css";

type Match={id:number;home_team:string;away_team:string;match_time:string|null;finished:boolean;home_score:number|null;away_score:number|null};
type Tip={match_id:number;home_tip:number;away_tip:number};

function fmt(value:string|null){if(!value)return"Tid ikke satt";return new Intl.DateTimeFormat("nb-NO",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Oslo"}).format(new Date(value))}
function locked(match:Match){return Boolean(match.match_time&&new Date(match.match_time).getTime()<=Date.now())}

export default function HomeTippingCoupon({matches,tips}:{matches:Match[];tips:Tip[]}){
 const tipMap=new Map(tips.map(t=>[t.match_id,t]));
 if(!matches.length)return <div className={styles.empty}>Ingen kommende kamper akkurat nå.</div>;
 return <div className={styles.list}>{matches.map(match=>{const tip=tipMap.get(match.id),isLocked=locked(match);const label=isLocked?"Låst":tip?"Tippet":"Ikke tippet";const statusClass=isLocked?styles.statusLocked:tip?styles.statusDone:styles.statusMissing;return <div className={styles.match} key={match.id}><div className={styles.meta}><span>{fmt(match.match_time)}</span><span className={`${styles.status} ${statusClass}`}>{label}</span></div><div className={styles.teams}><span>{match.home_team}</span><span>–</span><span>{match.away_team}</span></div><div className={styles.tip}><small>Ditt tips</small><strong>{tip?`${tip.home_tip}–${tip.away_tip}`:"–"}</strong></div></div>})}</div>;
}
