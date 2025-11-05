import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import useAuth from "../lib/auth"

export default function NavBar() {
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()
  const role = profile?.role || "member"
  const [open, setOpen] = useState(false)

  // Close menu when navigating
  function NavLink({ to, children }) {
    const active = pathname === to
    return (
      <Link
        to={to}
        onClick={() => setOpen(false)}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          textDecoration: "none",
          border: "1px solid #1f2937",
          color: active ? "#fff" : "#cbd5e1",
          background: active ? "#172136" : "transparent",
          display: "block"
        }}
      >
        {children}
      </Link>
    )
  }

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "#0b1426", borderBottom: "1px solid #1f2937"
    }}>
      <style>{`
        .nav-wrap { max-width: 1100px; margin: 0 auto; padding: 10px 16px; }
        .nav-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .nav-links { display: flex; align-items: center; gap: 10px; }
        .nav-right { display: flex; align-items: center; gap: 10px; }
        .menu-btn { display: none; }
        .mobile-panel { display: none; }

        @media (max-width: 640px) {
          .menu-btn { display: inline-flex; align-items: center; justify-content: center; }
          .nav-links { display: none; }
          .mobile-panel {
            display: block;
            padding: 10px 0;
            border-top: 1px solid #1f2937;
          }
          .mobile-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>

      <div className="nav-wrap">
        <div className="nav-row">
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              to="/"
              onClick={() => setOpen(false)}
              style={{
                padding: "8px 12px", borderRadius: 10, border: "1px solid #1f2937",
                textDecoration: "none", color: "#fff",
                background: pathname === "/" ? "#172136" : "transparent",
                fontWeight: 700
              }}
            >
              Fire Fit
            </Link>
          </div>

          {/* Desktop links */}
          {user && (
            <nav className="nav-links">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/members">Members</NavLink>
              <NavLink to="/standards">Standards</NavLink>
              <NavLink to="/checkoffs">Checkoffs</NavLink>
              <NavLink to="/weekly">Weekly</NavLink>
              <NavLink to="/leaderboard">Leaderboard</NavLink>
              <NavLink to="/all-time-leaders">All-Time Leaders 🏆</NavLink>
              <NavLink to="/my">My Profile</NavLink>
            </nav>
          )}

          {/* Right side */}
          <div className="nav-right">
            {user ? (
              <>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "4px 10px", borderRadius: 999,
                  background: "#0f1a30", border: "1px solid #1f2937",
                  color: "#e5e7eb", fontSize: 12
                }}>
                  <b style={{ textTransform: "uppercase" }}>{role}</b>
                  <span style={{ color: "#cbd5e1", fontSize: 12 }}>
                    {profile?.displayName || user.email}
                  </span>
                </span>

                {/* Desktop logout */}
                <button
                  onClick={signOut}
                  style={{
                    padding: "8px 12px", borderRadius: 10, background: "#172136",
                    color: "#fff", border: "1px solid #1f2937", cursor: "pointer"
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink to="/login">Login</NavLink>
            )}

            {/* Mobile hamburger */}
            {user && (
              <button
                className="menu-btn"
                aria-label="Toggle menu"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                style={{
                  width: 38, height: 38, marginLeft: 4,
                  borderRadius: 10, border: "1px solid #1f2937",
                  background: "#172136", color: "#e5e7eb", cursor: "pointer"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile slide-down panel */}
        {user && open && (
          <div className="mobile-panel">
            <div className="mobile-grid">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/members">Members</NavLink>
              <NavLink to="/standards">Standards</NavLink>
              <NavLink to="/checkoffs">Checkoffs</NavLink>
              <NavLink to="/weekly">Weekly</NavLink>
              <NavLink to="/leaderboard">Leaderboard</NavLink>
              <NavLink to="/all-time-leaders">All-Time Leaders 🏆</NavLink>
              <NavLink to="/my">My Profile</NavLink>

              {/* Mobile logout */}
              <button
                onClick={() => { setOpen(false); signOut() }}
                style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: "#7c1c1c", border: "1px solid #5b1515",
                  color: "#fff", textAlign: "left", cursor: "pointer"
                }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
