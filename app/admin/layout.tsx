export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{maxWidth:1180,margin:"18px auto 0",padding:"0 18px"}}>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <a
            href="/fantasy"
            style={{
              display:"inline-flex",
              alignItems:"center",
              gap:8,
              padding:"10px 14px",
              borderRadius:12,
              border:"1px solid rgba(84,222,168,.35)",
              background:"rgba(84,222,168,.08)",
              color:"inherit",
              fontWeight:900,
              textDecoration:"none",
            }}
          >
            🏒 Fantasy Hockey
          </a>
        </div>
      </div>
      {children}
    </>
  );
}
