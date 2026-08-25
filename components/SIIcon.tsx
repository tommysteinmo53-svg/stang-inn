import type {ReactNode,SVGProps} from "react";

export type SIIconName="home"|"fantasy"|"tips"|"live"|"leagues"|"menu"|"overview"|"team"|"player"|"stats"|"trophy"|"calendar"|"rules"|"bell";

const paths:Record<SIIconName,ReactNode>={
 home:<><path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10.5V20h11v-9.5"/><path d="M9.5 20v-5h5v5"/></>,
 fantasy:<><path d="M5 14.5 15.5 4l4.5 4.5L9.5 19H5v-4.5Z"/><path d="m13.5 6 4.5 4.5"/><path d="M4 20h7"/></>,
 tips:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v3M20 12h-3M12 20v-3M4 12h3"/></>,
 live:<><path d="M8.5 6.5a8 8 0 0 0 0 11"/><path d="M15.5 6.5a8 8 0 0 1 0 11"/><circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none"/></>,
 leagues:<><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3.5 19c.5-3.2 2.1-5 4.5-5s4 1.8 4.5 5"/><path d="M11.5 19c.5-3.2 2.1-5 4.5-5s4 1.8 4.5 5"/></>,
 menu:<><path d="M5 7h14M5 12h14M5 17h14"/></>,
 overview:<><path d="M5 17V7h14v10"/><path d="M8 14h8M9 10h6"/><path d="M4 20h16"/></>,
 team:<><circle cx="8" cy="8.5" r="2.5"/><circle cx="16" cy="8.5" r="2.5"/><path d="M3.5 18c.4-3 2-4.8 4.5-4.8s4.1 1.8 4.5 4.8"/><path d="M11.5 18c.4-3 2-4.8 4.5-4.8s4.1 1.8 4.5 4.8"/></>,
 player:<><circle cx="12" cy="7.5" r="3"/><path d="M6.5 20c.5-4.1 2.3-6.2 5.5-6.2s5 2.1 5.5 6.2"/></>,
 stats:<><path d="M5 19V9M12 19V5M19 19v-7"/><path d="M3.5 19.5h17"/></>,
 trophy:<><path d="M8 5h8v4.5a4 4 0 0 1-8 0V5Z"/><path d="M8 7H5.5v1.5A3.5 3.5 0 0 0 9 12"/><path d="M16 7h2.5v1.5A3.5 3.5 0 0 1 15 12"/><path d="M12 13.5V17M9 20h6M10 17h4"/></>,
 calendar:<><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4M16 4v4M4 10h16"/></>,
 rules:<><path d="M6 5.5h9a3 3 0 0 1 3 3V19H9a3 3 0 0 0-3 1V5.5Z"/><path d="M6 5.5H5a1 1 0 0 0-1 1V19h2"/><path d="M9 10h6M9 13h6"/></>,
 bell:<><path d="M7 17h10l-1.4-2V10a3.6 3.6 0 0 0-7.2 0v5L7 17Z"/><path d="M10 20h4"/></>
};

export default function SIIcon({name,size=20,...props}:{name:SIIconName;size?:number}&SVGProps<SVGSVGElement>){return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>}
