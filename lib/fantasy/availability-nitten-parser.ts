export type NittenAvailabilityStatus="questionable"|"out"|"long_term"|"returning";
export type NittenAvailabilityFinding={playerName:string;status:NittenAvailabilityStatus;evidence:string};

const clean=(s:string)=>s.replace(/\s+/g," ").trim();
const sentenceFor=(text:string,index:number)=>{const protectedText=text.replace(/\b([A-ZÆØÅ])\.(?=\s+[A-ZÆØÅ])/g,"$1§");const start=Math.max(0,Math.max(protectedText.lastIndexOf(".",index-1),protectedText.lastIndexOf("!",index-1),protectedText.lastIndexOf("?",index-1))+1);const ends=[protectedText.indexOf(".",index),protectedText.indexOf("!",index),protectedText.indexOf("?",index)].filter(v=>v>=0);const end=ends.length?Math.min(...ends)+1:Math.min(text.length,index+260);return clean(text.slice(start,end))};
const clauseFor=(sentence:string,name:string)=>{const s=sentence.toLocaleLowerCase("nb-NO"),n=name.toLocaleLowerCase("nb-NO"),at=s.indexOf(n);if(at<0)return sentence;const left=Math.max(s.lastIndexOf(" mens ",at),s.lastIndexOf(" men ",at),s.lastIndexOf(";",at),s.lastIndexOf(":",at));const rightCandidates=[s.indexOf(" mens ",at+n.length),s.indexOf(" men ",at+n.length),s.indexOf(";",at+n.length)].filter(v=>v>=0);const right=rightCandidates.length?Math.min(...rightCandidates):s.length;return clean(sentence.slice(left>=0?left+1:0,right))};
const statusFor=(sentence:string,name:string):NittenAvailabilityStatus|null=>{const clause=clauseFor(sentence,name),s=clause.toLocaleLowerCase("nb-NO"),n=name.toLocaleLowerCase("nb-NO"),at=s.indexOf(n);if(at<0)return null;const before=s.slice(Math.max(0,at-110),at),after=s.slice(at+n.length,Math.min(s.length,at+n.length+140));const beforeWide=s.slice(Math.max(0,at-220),at),afterWide=s.slice(at+n.length,Math.min(s.length,at+n.length+280));const local=`${before} ${n} ${after}`;
 if(/tilbake/.test(after)||/tilbake[^.]{0,50}$/.test(before))return"returning";
 if(/ute for sesongen|ute resten av sesongen|langtidssk/.test(after)||(/ute for sesongen|ute resten av sesongen/.test(s)&&!/soner|karantene/.test(after)))return"long_term";
 if(/karantene|soner|skadet|skadd|fortsatt (?:er )?ute|har vært ute lenge|har manglet|mangler|kun [^.,;]{0,40} ute/.test(local))return"out";
 if(/blir ikke med|blir hjemme|står over|eneste fravær/.test(afterWide))return"out";
 if(/har vært ute[^.;]{0,100}(?:med )?skad/.test(afterWide)||/har vært ute[^.;]{0,100}(?:med )?skad/.test(beforeWide))return"out";
 if(/troppen (?:er|blir|reiser|drar)[^.;]{0,120}\bmed\b/.test(beforeWide)&&/\bute\b/.test(afterWide))return"out";
 if(/usikker|tvilsom|dag til dag/.test(local))return"questionable";return null};

export function parseNittenAvailabilityArticle(text:string,playerNames:string[]):NittenAvailabilityFinding[]{const normalized=clean(text),lower=normalized.toLocaleLowerCase("nb-NO"),out:NittenAvailabilityFinding[]=[];for(const playerName of playerNames){let from=0;const needle=playerName.toLocaleLowerCase("nb-NO");while(from<normalized.length){const index=lower.indexOf(needle,from);if(index<0)break;const evidence=sentenceFor(normalized,index),status=statusFor(evidence,playerName);if(status){out.push({playerName,status,evidence});break}from=index+playerName.length}}return out}
