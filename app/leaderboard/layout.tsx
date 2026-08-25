import TippingSectionNav from "../../components/TippingSectionNav";

export default function LeaderboardLayout({children}:{children:React.ReactNode}){
 return <><div className="appShell tippingHubNavShell"><TippingSectionNav/></div>{children}</>;
}
