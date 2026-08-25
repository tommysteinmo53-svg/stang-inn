import type {ReactNode,SVGProps} from "react";

export type SIIconName=
 "home"|"fantasy"|"tips"|"live"|"leagues"|"menu"|"overview"|"team"|"player"|"stats"|"trophy"|"calendar"|"rules"|"bell"|
 "achievement"|"event"|"booster"|"transfer"|"captain";

/*
 * Stang Inn icon language
 * -----------------------
 * 24x24, angular hockey geometry, shared rink / puck / stick / shield motifs.
 * These are intentionally not generic emoji-outline equivalents.
 */
const paths:Record<SIIconName,ReactNode>={
 home:<>
  <path d="M4.5 6.5h15v11h-15z"/>
  <path d="M12 6.5v11M4.5 12h15"/>
  <circle cx="12" cy="12" r="2.15"/>
  <path d="M7.2 9.2 5.4 12l1.8 2.8M16.8 9.2l1.8 2.8-1.8 2.8"/>
 </>,
 fantasy:<>
  <path d="m5.2 17.8 8.9-11.6 2.4 1.8-8.9 11.6H4.8z"/>
  <path d="m18.8 17.8-8.9-11.6L7.5 8l8.9 11.6h2.8z"/>
  <ellipse cx="12" cy="18.8" rx="3.1" ry="1.15"/>
  <path d="M12 3.8v2.1"/>
 </>,
 tips:<>
  <path d="M4.5 7.3h15v9.4h-15z"/>
  <path d="M7.2 9.5h3.1v5H7.2zM13.7 9.5h3.1v5h-3.1z"/>
  <ellipse cx="12" cy="19.1" rx="2.8" ry="1"/>
  <path d="M12 16.7v1.4"/>
 </>,
 live:<>
  <ellipse cx="12" cy="15.8" rx="3" ry="1.1"/>
  <path d="M12 14.5V9.8"/>
  <path d="M8.8 11.2a4.5 4.5 0 0 1 6.4 0M6.2 8.7a8 8 0 0 1 11.6 0"/>
  <circle cx="12" cy="8.4" r="1.3" fill="currentColor" stroke="none"/>
 </>,
 leagues:<>
  <path d="M12 3.8 19 6.5v5.3c0 4.2-2.4 7-7 8.5-4.6-1.5-7-4.3-7-8.5V6.5z"/>
  <circle cx="9.1" cy="11" r="1.6"/>
  <circle cx="14.9" cy="11" r="1.6"/>
  <path d="M6.9 15.8c.5-1.8 1.3-2.7 2.5-2.7s2.1.9 2.6 2.7M12 15.8c.5-1.8 1.4-2.7 2.6-2.7s2 .9 2.5 2.7"/>
 </>,
 menu:<>
  <path d="M6 7h12M8 12h10M6 17h12"/>
  <circle cx="4" cy="7" r=".9" fill="currentColor" stroke="none"/>
  <circle cx="6" cy="12" r=".9" fill="currentColor" stroke="none"/>
  <circle cx="4" cy="17" r=".9" fill="currentColor" stroke="none"/>
 </>,
 overview:<>
  <path d="M4.5 6.2h15v11.6h-15z"/>
  <path d="M12 6.2v11.6"/>
  <circle cx="12" cy="12" r="2.2"/>
  <path d="M4.5 9h3.2v6H4.5M19.5 9h-3.2v6h3.2"/>
 </>,
 team:<>
  <path d="m8.3 5.2 3.7 2 3.7-2 3 3.2-2.1 3V20H7.4v-8.6l-2.1-3z"/>
  <path d="M9.2 9.5h5.6M12 9.5V20"/>
  <path d="M9.4 15.2h5.2"/>
 </>,
 player:<>
  <path d="M7.2 10.6c0-4 2-6.1 4.8-6.1s4.8 2.1 4.8 6.1v1.2H7.2z"/>
  <path d="M8.2 8.3h7.6M9.1 11.8v2.1c0 2 1.2 3.6 2.9 3.6s2.9-1.6 2.9-3.6v-2.1"/>
  <path d="M6.2 20c.8-2.5 2.6-3.7 5.8-3.7s5 1.2 5.8 3.7"/>
 </>,
 stats:<>
  <path d="M4.5 18.5h15"/>
  <path d="m6 16 3.1-4.1 2.6 2 5.8-7.1"/>
  <ellipse cx="6" cy="16" rx="1.6" ry=".7"/>
  <ellipse cx="17.5" cy="6.8" rx="1.6" ry=".7"/>
  <path d="M12 6.2v5.9"/>
 </>,
 trophy:<>
  <path d="M12 3.8 18.5 6v5c0 4-2.2 6.5-6.5 8-4.3-1.5-6.5-4-6.5-8V6z"/>
  <path d="m8.4 12.1 2.1 2.1 5-5"/>
  <ellipse cx="12" cy="20" rx="3.3" ry="1"/>
 </>,
 calendar:<>
  <path d="M5 6.5h14v12H5z"/>
  <path d="M8 4.5v4M16 4.5v4M5 10h14"/>
  <circle cx="12" cy="14.3" r="2.2"/>
  <path d="M12 12.1v4.4"/>
 </>,
 rules:<>
  <path d="M6.2 4.8h10.5l1.1 1.1v13.3H6.2z"/>
  <path d="M9 8h5.9M9 11h5.9M9 14h3.5"/>
  <path d="m7.4 18 8.8-12"/>
 </>,
 bell:<>
  <path d="M6.5 15.8h11l-1.4-2.2v-3.2c0-2.9-1.5-4.7-4.1-4.7s-4.1 1.8-4.1 4.7v3.2z"/>
  <ellipse cx="12" cy="18.3" rx="2.6" ry=".9"/>
  <path d="M4.5 8.5 6 7M19.5 8.5 18 7"/>
 </>,
 achievement:<>
  <path d="M12 3.7 18.2 6v5.2c0 3.8-2 6.3-6.2 7.9-4.2-1.6-6.2-4.1-6.2-7.9V6z"/>
  <path d="m12 7.2 1.2 2.5 2.8.4-2 1.9.5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-1.9 2.8-.4z"/>
 </>,
 event:<>
  <path d="M4.8 7h14.4v10H4.8z"/>
  <path d="M12 7v10"/>
  <path d="m13.8 8.5-3.6 4h2.6l-2.6 3"/>
  <circle cx="6.7" cy="12" r="1"/><circle cx="17.3" cy="12" r="1"/>
 </>,
 booster:<>
  <ellipse cx="6" cy="17.7" rx="2.3" ry=".85"/>
  <path d="M7.5 15.5 13 9.2l2 1.7-5.5 6.3"/>
  <path d="m13.2 6.2 2.6 2.6M16.2 4.8l2.8 2.8"/>
  <path d="M15.5 14.2h4M17.5 12.2v4"/>
 </>,
 transfer:<>
  <ellipse cx="7" cy="16.8" rx="2.4" ry=".9"/>
  <ellipse cx="17" cy="7.2" rx="2.4" ry=".9"/>
  <path d="M8.8 14.8 15 8.8M14.3 12.1l.7-3.3-3.3.4"/>
  <path d="M15.2 9.2 9 15.2M9.7 11.9 9 15.2l3.3-.4"/>
 </>,
 captain:<>
  <path d="M12 3.8 18.5 6v5.1c0 4-2.2 6.5-6.5 8-4.3-1.5-6.5-4-6.5-8V6z"/>
  <path d="M15.1 9.2c-.6-1-1.6-1.6-3-1.6-2.2 0-3.7 1.6-3.7 4s1.5 4 3.7 4c1.4 0 2.4-.6 3-1.6"/>
 </>
};

export default function SIIcon({name,size=20,...props}:{name:SIIconName;size?:number}&SVGProps<SVGSVGElement>){
 return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
