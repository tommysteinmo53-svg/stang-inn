import {parseNittenAvailabilityArticle,type NittenAvailabilityFinding,type NittenAvailabilityStatus} from "./availability-nitten-parser";

export type NittenBacktestStatus=NittenAvailabilityStatus;
export type NittenBacktestFinding=NittenAvailabilityFinding;

/** Read-only historical parser. It never writes findings or availability and intentionally ignores the 45-day production freshness gate. */
export function backtestNittenArticle(text:string,playerNames:string[]):NittenBacktestFinding[]{return parseNittenAvailabilityArticle(text,playerNames)}

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
