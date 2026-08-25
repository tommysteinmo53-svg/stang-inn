import FantasyNav from "./FantasyNav";
import FantasyAuthGate from "./FantasyAuthGate";
import "./fantasy-nav.css";
import "./leaderboard/leaderboard.css";
import "./rounds/rounds.css";
import "./team/team-launch.css";
import "./fantasy-premium.css";
import "./fantasy-final-polish.css";

export default function FantasyLayout({children}:{children:React.ReactNode}){
 return <FantasyAuthGate><FantasyNav/>{children}</FantasyAuthGate>;
}
