export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const linkStyle={display:"inline-flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(84,222,168,.35)",background:"rgba(84,222,168,.08)",color:"inherit",fontWeight:900,textDecoration:"none"} as const;
  return (
    <>
      <div style={{maxWidth:1180,margin:"18px auto 0",padding:"0 18px"}}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap"}}>
          <a href="/admin" style={linkStyle}>🛠️ Admin</a>
          <a href="/admin/fantasy" style={linkStyle}>🏒 Fantasyhockey</a>
          <a href="/admin/hockeytips" style={linkStyle}>🎯 Hockeytipset</a>
        </div>
      </div>
      {children}
    </>
  );
}
