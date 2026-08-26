import "./admin-polish.css";
import SIIcon from "../../components/SIIcon";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="adminTopNav" aria-label="Adminmeny">
        <div className="adminTopNavInner">
          <a href="/admin"><SIIcon name="overview" size={18}/> <span>Admin</span></a>
          <a href="/admin/users"><SIIcon name="player" size={18}/> <span>Brukere</span></a>
          <a href="/admin/fantasy"><SIIcon name="fantasy" size={18}/> <span>Fantasyhockey</span></a>
          <a href="/admin/hockeytips"><SIIcon name="tips" size={18}/> <span>Hockeytipset</span></a>
        </div>
      </nav>
      {children}
    </>
  );
}
