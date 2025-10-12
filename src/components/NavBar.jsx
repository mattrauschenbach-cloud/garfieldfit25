// src/components/NavBar.jsx
import { NavLink, useNavigate } from "react-router-dom"
import useAuth from "../lib/auth"

const linkBase =
  "px-3 py-2 rounded-md text-sm font-medium transition-colors"
const active =
  "bg-[#0f1a30] text-white border border-[#1f2937]"
const inactive =
  "text-gray-300 hover:text-white hover:bg-[#0f1a30] border border-transparent"

export default function NavBar() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const role = profile?.role || "member"
  const isMentor = ["mentor","admin","owner"].includes(role)
  const isOwner  = role === "owner"

  return (
    <header className="w-full sticky top-0 z-40" style={{background:"#0b1426", borderBottom:"1px solid #1f2937"}}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-white">Fire-Fit</span>
            <span className="hidden sm:inline text-xs text-gray-400">v0.9</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <NavLink to="/" className={({isActive}) => `${linkBase} ${isActive ? active : inactive}`}>Home</NavLink>
            <NavLink to="/members" className={({isActive}) => `${linkBase} ${isActive ? active : inactive}`}>Members</NavLink>
            <NavLink to="/standards" className={({isActive}) => `${linkBase} ${isActive ? active : inactive}`}>Standards</NavLink>
            <NavLink to="/checkoffs" className={({isActive}) => `${linkBase} ${isActive ? active : inactive}`}>Checkoffs</NavLink>
            <NavLink to="/weekly" className={({isActive}) => `${linkBase} ${isActive ? active : inactive}`}>Weekly</NavLink>
            {/* Optional: only show if you kept a profile page */}
            <NavLink to="/my" className={({isActive}) => `${linkBase} ${isActive ? active : inactive}`}>My Profile</NavLink>

            {/* Owner / Admin tools shortcut (optional) */}
            {isOwner && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-300">Owner</span>
            )}
            {isMentor && !isOwner && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-sky-300">Mentor</span>
            )}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:inline text-xs text-gray-300">
                  {profile?.displayName || user.e
