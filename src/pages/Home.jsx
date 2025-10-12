// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query
} from "firebase/firestore"

const card = { padding:16, border:"1px solid #1f2937", borderRadius:12, background:"#0b1426" }
const linkBtn = {
  display:"inline-block", padding:"8px 12px", borderRadius:8,
  background:"#172136", color:"#fff", border:"1px solid #1f2937", textDecoration:"none"
}
const badge = { display:"inline-block", padding:"2px 8px", borderRadius:999, background:"#0f1a30", color:"#e5e7eb", fontSize:12, border:"1px solid #1f2937" }

export default function Home(){
  const { user, profile } = useAuth()
  const role = profile?.role || "member"
  const roleColor = role === "owner" ? "#6ee7b7" : (["admin","mentor"].includes(role) ? "#7dd3fc" : "#e5e7eb")

  // Stats
  const [standardsCount, setStandardsCount] = useState(0)
  const [myCheckoffs, setMyCheckoffs]       = useState(0)

  // Weekly
  const [week, setWeek]   = useState(null)   // {id, title, unit}
  const [weekTotal, setWeekTotal] = useState(0)
  const [myWeekTotal, setMyWeekTotal] = useState(0)

  // ---- Standards count
  useEffect(() => {
    const qy = query(collection(db, "standards"), orderBy("tier"))
    const unsub = onSnapshot(qy, snap => setStandardsCount(snap.size))
    return unsub
  }, [])

  // ---- My checkoffs count
  useEffect(() => {
    if (!user) { setMyCheckoffs(0); return }
    const qy = collection(db, "profiles", user.uid, "checkoffs")
    const unsub = onSnapshot(qy, snap => {
      let cnt = 0
      snap.forEach(d => { if (d.data()?.done) cnt++ })
      setMyCheckoffs(cnt)
    })
    return unsub
  }, [user?.uid])

  // ---- Current week (latest by startDate)
  useEffect(() => {
    const qy = query(collection(db, "weeklyChallenges"), orderBy("startDate", "desc"), limit(1))
    const unsub = onSnapshot(qy, async (snap) => {
      const docSnap = snap.docs[0]
      if (!docSnap) { setWeek(null); setWeekTotal(0); setMyWeekTotal(0); return }
      const w = { id: docSnap.id, ...(docSnap.data()||{}) }
      w.unit = w.unit || "reps"
      setWeek(w)

      // subscribe logs for this week
      const logsQ = query(collection(db, "weeklyChallenges", docSnap.id, "logs"), orderBy("updatedAt","desc"))
      const unsubLogs = onSnapshot(logsQ, (ls) => {
        let total = 0, mine = 0
        ls.forEach(l => {
          const v = Number(l.data()?.value)
          if (Number.isFinite(v)) {
            total += v
            if (user && l.data()?.uid === user.uid) mine += v
          }
        })
        setWeekTotal(total)
        setMyWeekTotal(mine)
      })
      return () => unsubLogs()
    })
    return unsub
  }, [user?.uid])

  return (
    <div className="container" style={{display:"grid", gap:16}}>
      {/* Welcome */}
      <div style={card}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap"}}>
          <div>
            <h2 style={{margin:"0 0 6px 0", color:"#fff"}}>Welcome{profile?.displayName ? `, ${profile.displayName}` : ""} 👋</h2>
            <p style={{margin:0, color:"#cbd5e1"}}>
              Quick snapshot of your progress and what’s happening this week.
            </p>
          </div>
          <span style={{...badge, color:roleColor}}>Role: {role}</span>
        </div>
      </div>

      {/* Quick links */}
      <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
        <div style={card}>
          <h4 style={{margin:"0 0 8px 0", color:"#e5e7eb"}}>Members</h4>
          <p style={{margin:"0 0 12px 0", color:"#9ca3af"}}>Browse and manage member profiles.</p>
          <Link to="/members" style={linkBtn}>Open Members</Link>
        </div>
        <div style={card}>
          <h4 style={{margin:"0 0 8px 0", color:"#e5e7eb"}}>Standards</h4>
          <p style={{margin:"0 0 12px 0", color:"#9ca3af"}}>See tier standards. Owner can edit.</p>
          <Link to="/standards" style={linkBtn}>Open Standards</Link>
        </div>
        <div style={card}>
          <h4 style={{margin:"0 0 8px 0", color:"#e5e7eb"}}>Checkoffs</h4>
          <p style={{margin:"0 0 12px 0", color:"#9ca3af"}}>Check your progress against standards.</p>
          <Link to="/checkoffs" style={linkBtn}>Open Checkoffs</Link>
        </div>
        <div style={card}>
          <h4 style={{margin:"0 0 8px 0", color:"#e5e7eb"}}>Weekly</h4>
          <p style={{margin:"0 0 12px 0", color:"#9ca3af"}}>Log toward this week’s challenge together.</p>
          <Link to="/weekly" style={linkBtn}>Open Weekly</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
        <div style={card}>
          <span style={badge}>Standards</span>
          <h3 style={{margin:"8px 0 0 0", color:"#fff"}}>{standardsCount}</h3>
          <p style={{margin:"6px 0 0 0", color:"#9ca3af"}}>Total standards available</p>
        </div>
        <div style={card}>
          <span style={badge}>My Checkoffs</span>
          <h3 style={{margin:"8px 0 0 0", color:"#fff"}}>{myCheckoffs}</h3>
          <p style={{margin:"6px 0 0 0", color:"#9ca3af"}}>Standards you’ve completed</p>
        </div>
        <div style={card}>
          <span style={badge}>This Week (All)</span>
          <h3 style={{margin:"8px 0 0 0", color:"#fff"}}>{weekTotal} {week?.unit || ""}</h3>
          <p style={{margin:"6px 0 0 0", color:"#9ca3af"}}>Sum of all member logs</p>
        </div>
        <div style={card}>
          <span style={badge}>This Week (Me)</span>
          <h3 style={{margin:"8px 0 0 0", color:"#fff"}}>{myWeekTotal} {week?.unit || ""}</h3>
          <p style={{margin:"6px 0 0 0", color:"#9ca3af"}}>Your total logs this week</p>
        </div>
      </div>

      {/* Current week preview */}
      <div style={card}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap"}}>
          <span style={badge}>Weekly Challenge</span>
          {week?.active !== undefined && (
            <span style={badge}>{week.active ? "active" : "inactive"}</span>
          )}
        </div>
        {week ? (
          <div style={{marginTop:8}}>
            <h3 style={{margin:"0 0 6px 0", color:"#fff"}}>{week.title}</h3>
            {week.description && <p style={{margin:"0 0 6px 0", color:"#cbd5e1"}}>{week.description}</p>}
            <p style={{margin:0, color:"#9ca3af", fontSize:13}}>
              {week.startDate && <>Start: {week.startDate} · </>}
              {week.endDate && <>End: {week.endDate} · </>}
              Unit: {week.unit} · Mode: {week.scoreMode === "lower_is_better" ? "Lower is better" : "Higher is better"}
            </p>
          </div>
        ) : (
          <p style={{marginTop:8, color:"#9ca3af"}}>No weekly challenge yet. Owners can create one on the Weekly page.</p>
        )}
      </div>
    </div>
  )
}
