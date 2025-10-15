// src/pages/Home.jsx
import useAuth from "../lib/auth"
import HomeMessages from "../components/HomeMessages"
import { Link } from "react-router-dom"

export default function Home(){
  const { user, profile } = useAuth()
  const name = profile?.displayName || user?.email || "Member"
  const role = profile?.role || "member"

  return (
    <div className="container vstack" style={{gap:12}}>
      {/* Header card */}
      <div className="card vstack" style={{gap:8}}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8}}>
          <div className="vstack" style={{gap:4}}>
            <span className="badge">Welcome</span>
            <h2 style={{margin:0}}>{name}</h2>
            <div style={{color:"#9ca3af", fontSize:13}}>Role: <b style={{textTransform:'uppercase'}}>{role}</b></div>
          </div>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <Link className="btn" to="/weekly">Weekly</Link>
            <Link className="btn" to="/standards">Standards</Link>
            <Link className="btn" to="/checkoffs">Checkoffs</Link>
            <Link className="btn" to="/leaderboard">Leaderboard</Link>
          </div>
        </div>
      </div>

      {/* Announcements / Messages */}
      <HomeMessages />
    </div>
  )
}
