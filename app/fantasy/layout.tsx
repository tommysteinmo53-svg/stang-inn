import FantasyNav from "./FantasyNav";
import "./fantasy-nav.css";

export default function FantasyLayout({children}:{children:React.ReactNode}){
 return <><FantasyNav/>{children}</>;
}
