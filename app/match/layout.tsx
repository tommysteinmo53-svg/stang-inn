import TippingSectionNav from "../../components/TippingSectionNav";

export default function MatchLayout({children}:{children:React.ReactNode}){
 return <><div className="tippingHubNavShell"><TippingSectionNav/></div>{children}</>;
}
