// src/components/NavBar.jsx
import { NavLink, useNavigate } from "react-router-dom"
import useAuth from "../lib/auth"

const shell = {
  background: "#0b1426",
  borderBottom: "1px solid #1f2937",
  position: "sticky",
  top: 0,
  zIndex: 40,
}
const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 16px" }
const row  = { display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }

const linkBase = {
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
  border: "1px solid transparent",
  transition: "background 120ms, color 120ms, border-color 120ms",
  color: "#d1d5db",
}
const linkActive = {
  background: "#0f1a30",
  color: "#ffffff",
  borderColor: "#1f2937",
}
const linkHover = { background: "#0f1a30", color: "#ffffff" }

function LinkItem({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...linkBase,
        ...(isActive ? linkActive : null),
      })}
      onMouseEnter={e => Object.assign(e.currentTarget.style, linkHover)}
      onMouseLeave={e => Object.assign(e.currentTarget.style, (e.currentTarget.getAttribute("data-active")==="1") ? linkActive : linkBase)}
      data-active={({ isActive }) => (isActive ? "1" : "0")}
      // data-active is set correctly via style prop below (hack for onMouseLeave)
    >
      {children}
    </NavLink>
  )
}

export default function NavBar() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const role = profile?.role || "member"
  const isMentor = ["mentor","admin","owner"].includes(role)
  const isOwner  = role === "owner"

  return (
    <header style={shell}>
      <div style={wrap}>
        <div style={row}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#ffffff" }}>Fire-Fit</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>v0.9</span>
          </div>

          {/* Links */}
          <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LinkItem to="/">Home</LinkItem>
            <LinkItem to="/members">Members</LinkItem>
            <LinkItem to="/standards">Standards</LinkItem>
            <LinkItem to="/checkoffs">Checkoffs</LinkItem>
            <LinkItem to="/weekly">Weekly</LinkItem>
            <LinkItem to="/my">My Profile</LinkItem>

            {/* role badges */}
            {isOwner && (
              <span style={{ marginLeft: 8, fontSize: 10, color: "#6ee7b7", letterSpacing: 1 }}>OWNER</span>
            )}
            {isMentor && !isOwner && (
              <span style={{ marginLeft: 8, fontSize: 10, color: "#7dd3fc", letterSpacing: 1 }}>MENTOR</span>
            )}
          </nav>

          {/* Auth */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user ? (
              <>
                <span style={{ fontSize: 12, color: "#d1d5db" }}>
                  {profile?.displayName || user.email}
                </span>
                <button
                  onClick={async () => { await signOut(); navigate("/login") }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    background: "#172136",
                    color: "#ffffff",
                    border: "1px solid #1f2937",
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                style={{
                  ...linkBase,
                  background: "#172136",
                  color: "#ffffff",
                  border: "1px solid #1f2937",
                }}
              >
                Login
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
