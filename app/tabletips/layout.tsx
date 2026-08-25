import TippingSectionNav from "../../components/TippingSectionNav";
import "./tabletips-premium.css";

export default function TableTipsLayout({children}:{children:React.ReactNode}){
  return <div className="tableTipsHub"><TippingSectionNav/>{children}</div>;
}
