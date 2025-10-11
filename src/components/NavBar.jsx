import { NavLink, Link } from "react-router-dom"
import { useState } from "react"
import { useAuth } from "../lib/auth"

export default function NavBar(){
  const [open, setOpen] = useState(false)
  const { user, profile, signOut } = useAuth()

  const linkClass = ({ isActive }) =>
    "nav-link" + (isActive ? " active" : "")

  const role = profile?.role || "member"
  const canMentor = ["mentor","admin","owner"].includes(role)
  const canAdmin  = ["admin","owner"].includes(role)

  return (
    <nav className="nav">
      <div className="inner container" style={{padding: "10px 0"}}>
        <div className="hstack" style={{gap:10}}>
          <button className="btn ghost" aria-label="Toggle menu"
                  onClick={()=>setOpen(v=>!v)} style={{padding:"8px 10px"}}>
            ☰
          </button>
          <Link to="/" className="hstack" style={{gap:8, fontWeight:800, letterSpacing:.2}}>
            <span className="badge">Station 1</span>
            <span>Fit</span>
          </Link>
        </div>
        <div className="hstack" style={{gap:10}}>
          {user ? (
            <>
              <span className="badge">{role}</span>
              <button className="btn" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <Link className="btn" to="/login">Sign in</Link>
          )}
        </div>
      </div>

      <div className="container" style={{paddingBottom: open ? 12 : 0}}>
        <div className="vstack card" style={{display: open ? "flex":"none", padding:12}}>
          <NavLink to="/" className={linkClass} onClick={()=>setOpen(false)}>Home</NavLink>
          <NavLink to="/monthly" className={linkClass} onClick={()=>setOpen(false)}>Monthly Challenge</NavLink>
          <NavLink to="/members" className={linkClass} onClick={()=>setOpen(false)}>Members</NavLink>
          {canMentor && (
            <NavLink to="/monthly-admin" className={linkClass} onClick={()=>setOpen(false)}>Mentor</NavLink>
          )}
          {canAdmin && (
            <NavLink to="/admin-standards" className={linkClass} onClick={()=>setOpen(false)}>Admin Standards</NavLink>
          )}
          <NavLink to="/diag" className={linkClass} onClick={()=>setOpen(false)}>Diagnostics</NavLink>
        </div>
      </div>
      <style>{`
        .nav-link { padding:8px 10px; border-radius:10px; display:inline-flex; align-items:center; }
        .nav-link.active, .nav-link:hover { background:#0f1a30; text-decoration:none }
        @media (min-width: 820px){
          .nav .inner{ gap:16px; }
          .nav .container + .container{ display:none; } /* hide drawer on wide screens */
        }
      `}</style>
    </nav>
  )
}
