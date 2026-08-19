export type NittenBacktestStatus="questionable"|"out"|"long_term"|"returning";
export type NittenBacktestFinding={playerName:string;status:NittenBacktestStatus;evidence:string};

const clean=(s:string)=>s.replace(/\s+/g," ").trim();
const sentenceFor=(text:string,index:number)=>{const start=Math.max(0,Math.max(text.lastIndexOf(".",index-1),text.lastIndexOf("!",index-1),text.lastIndexOf("?",index-1))+1);const ends=[text.indexOf(".",index),text.indexOf("!",index),text.indexOf("?",index)].filter(v=>v>=0);const end=ends.length?Math.min(...ends)+1:Math.min(text.length,index+260);return clean(text.slice(start,end))};
const clauseFor=(sentence:string,name:string)=>{const s=sentence.toLocaleLowerCase("nb-NO"),n=name.toLocaleLowerCase("nb-NO"),at=s.indexOf(n);if(at<0)return sentence;const left=Math.max(s.lastIndexOf(" mens ",at),s.lastIndexOf(" men ",at),s.lastIndexOf(";",at),s.lastIndexOf(":",at));const rightCandidates=[s.indexOf(" mens ",at+n.length),s.indexOf(" men ",at+n.length),s.indexOf(";",at+n.length)].filter(v=>v>=0);const right=rightCandidates.length?Math.min(...rightCandidates):s.length;return clean(sentence.slice(left>=0?left+1:0,right))};
const statusFor=(sentence:string,name:string):NittenBacktestStatus|null=>{const clause=clauseFor(sentence,name),s=clause.toLocaleLowerCase("nb-NO"),n=name.toLocaleLowerCase("nb-NO"),at=s.indexOf(n);if(at<0)return null;const before=s.slice(Math.max(0,at-110),at),after=s.slice(at+n.length,Math.min(s.length,at+n.length+140));const local=`${before} ${n} ${after}`;
 if(/tilbake/.test(after)||/tilbake[^.]{0,50}$/.test(before))return"returning";
 if(/ute for sesongen|ute resten av sesongen|langtidssk/.test(after)||(/ute for sesongen|ute resten av sesongen/.test(clause.toLocaleLowerCase("nb-NO"))&&!/soner|karantene/.test(after)))return"long_term";
 if(/karantene|soner|skadet|skadd|fortsatt (?:er )?ute|har vært ute lenge|har manglet|mangler|kun [^.,;]{0,40} ute/.test(local))return"out";
 if(/usikker|tvilsom|dag til dag/.test(local))return"questionable";return null};

/** Read-only historical parser. It never writes findings or availability and intentionally ignores the 45-day production freshness gate. */
export function backtestNittenArticle(text:string,playerNames:string[]):NittenBacktestFinding[]{const normalized=clean(text),out:NittenBacktestFinding[]=[];for(const playerName of playerNames){let from=0;while(from<normalized.length){const index=normalized.toLocaleLowerCase("nb-NO").indexOf(playerName.toLocaleLowerCase("nb-NO"),from);if(index<0)break;const evidence=sentenceFor(normalized,index),status=statusFor(evidence,playerName);if(status){out.push({playerName,status,evidence});break}from=index+playerName.length}}return out}

export const NITTEN_GOLDEN_2026_03_08:Record<string,NittenBacktestStatus>={
 "Andreas Dahl":"out",
 "Stian Kaltrud Nystuen":"returning",
 "Sondre Olden":"out",
 "Leo Johansen Halmrast":"returning",
 "Didrik Utter":"out",
 "Stian Nybraaten Hansen":"out",
 "Sebastian Kaijser":"out",
 "Martin Grönberg":"out",
 "Jonas Nyhus Myhre":"out",
 "Simen Ahlsen":"out",
 "Filip Lalande":"out",
 "Sebastian Johansen":"out",
 "Linus Pettersson":"returning",
 "Lars Christian Rødne":"long_term",
 "Håkon Løken Pedersen":"long_term",
 "Ludvig Hoff":"long_term",
 "Martin Gran":"long_term",
 "Andrew Yogan":"out"
};
