// src/components/NavBar.jsx
import { Link, NavLink } from "react-router-dom"
import useAuth from "../lib/auth"

export default function NavBar(){
  const { user, signOut } = useAuth()
  const link = ({ isActive }) => "nav-link" + (isActive ? " active" : "")

  return (
    <nav className="nav container">
      <Link to="/" className="brand">Station 1 · Fit</Link>
      <div className="links">
        <NavLink to="/" className={link}>Home</NavLink>
        <NavLink to="/log" className={link}>Log</NavLink>
        <NavLink to="/members" className={link}>Members</NavLink>
        <NavLink to="/standards" className={link}>Standards</NavLink>
        <NavLink to="/checkoffs" className={link}>Checkoffs</NavLink>
        <NavLink to="/me" className={link}>My Profile</NavLink>
        <NavLink to="/diag" className={link}>Diag</NavLink>

        {user ? (
          <button className="btn" onClick={signOut}>Sign out</button>
        ) : (
          <NavLink to="/login" className="btn">Sign in</NavLink>
        )}
      </div>
    </nav>
  )
}
