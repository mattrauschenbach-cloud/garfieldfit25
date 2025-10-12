// src/components/NavBar.jsx
import { Link, useLocation } from "react-router-dom"
import useAuth from "../lib/auth"

const bar = {
  position: "sticky", top: 0, zIndex: 50,
  background: "#0b1426", borderBottom: "1px solid #1f2937"
}
const wrap = {
  maxWidth: 1100, margin: "0 auto", padding: "10px 16px",
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
}
const nav = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }
const link = (active) => ({
  padding: "6px 10px", borderRadius: 8,
  color: active ? "#fff" : "#cbd5e1",
  background: active ? "#172136" : "transparent",
  border: "1px solid #1f2937", textDecoration: "none"
})
const right = { display: "flex", alignItems: "center", gap: 10 }
const badge = {
  display: "inline-block", padding: "2px 8px", borderRadius: 999,
  background: "#0f1a30", color: "#e5e7eb", fontSize: 12, border: "1px solid #1f2937"
}
const btn = {
  padding: "6px 10px", borderRadius: 8,
  background: "#172136", color: "#fff", border: "1px solid #1f2937", cursor: "pointer"
}

export default function NavBar() {
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()
  const role = profile?.role || "member"

  return (
    <header style={bar}>
      <div style={wrap}>
        {/* Brand */}
        <div className="hstack" style={{ gap: 10, alignItems: "center" }}>
          <Link to="/" style={{ ...link(pathname === "/"), fontWeight: 700 }}>Fire Fit</Link>
          <span style={{ ...badge, display: "none" }}>beta</span>
        </div>

        {/* Nav links */}
        <nav style={nav}>
          {user && (
            <>
              <Link to="/" style={link(pathname === "/")}>Home</Link>
              <Link to="/members" style={link(pathname === "/members")}>Members</Link>
              <Link to="/standards" style={link(pathname === "/standards")}>Standards</Link>
              <Link to="/checkoffs" style={link(pathname === "/checkoffs")}>Checkoffs</Link>
              <Link to="/weekly" style={link(pathname === "/weekly")}>Weekly</Link>
              <Link to="/leaderboard" style={link(pathname === "/leaderboard")}>Leaderboard</Link>
              <Link to="/my" style={link(pathname === "/my")}>My Profile</Link>
            </>
          )}
        </nav>

        {/* Auth area */}
        <div style={right}>
          {user ? (
            <>
              <span className="hstack" style={{ gap: 6 }}>
                <span style={badge}>{role}</span>
                <span style={{ color: "#cbd5e1", fontSize: 13 }}>
                  {profile?.displayName || user.email}
                </span>
              </span>
              <button style={btn} onClick={signOut}>Logout</button>
            </>
          ) : (
            <Link to="/login" style={link(pathname === "/login")}>Login</Link>
          )}
        </div>
      </div>
    </header>
  )
}
