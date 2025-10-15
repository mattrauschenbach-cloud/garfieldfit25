// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  collection, collectionGroup, onSnapshot, orderBy, query, limit
} from "firebase/firestore"
import HomeMessages from "../components/HomeMessages"

// Small style helpers to match your theme
const subtle = { color:"#9ca3af", fontSize:12 }
const table = { width:"100%", borderCollapse:"collapse" }
const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af", borderBottom:"1px solid #1f2937", background:"#0f1a30" }
const td = { padding:"10px 12px", borderBottom:"1px solid #1f2937" }

// Big stat styles (weekly totals)
const statWrap = { display:"flex", gap:12, flexWrap:"wrap" }
const statCard = {
  minWidth: 160,
  padding:"14px 16px",
  border:"1px solid #1f2937",
  background:"#0f1a30",
  borderRadius:14
}
const statLabel = { color:"#9ca3af", fontSize:12 }
const statValue = { fontSize:28, fontWeight:800, lineHeight:1, marginTop:4, color:"#e5e7eb" }

// Progress bar styles
const barWrap = { width:"100%", background:"#0b1426", border:"1px solid #1f2937", borderRadius:10, height:16, overflow:"hidden" }
const barFill = (pct)=>({
  width:`${pct}%`, height:"100%", background:"#1f6feb", transition:"width .25s ease"
})

export default function Home(){
  const { user, profile } = useAuth()
  const name = profile?.displayName || user?.email || "Member"
  const role = profile?.role || "member"

  return (
    <div className="container vstack" style={{gap:12}}>
      {/* Header / Quick links */}
      <div className="card vstack" style={{gap:8}}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8}}>
          <div className="vstack" style={{gap:4}}>
            <span className="badge">Welcome</span>
            <h2 style={{margin:0}}>{name}</h2>
            <div style={subtle}>
              Role: <b style={{textTransform:"uppercase"}}>{role}</b>
            </div>
          </div>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <Link className="btn" to="/weekly">Weekly</Link>
            <Link className="btn" to="/standards">Standards</Link>
            <Link className="btn" to="/checkoffs">Checkoffs</Link>
            <Link className="btn" to="/leaderboard">Leaderboard</Link>
            <Link className="btn" to="/members">Members</Link>
          </div>
        </div>
      </div>

      {/* Announcements / Messages (staff can post/edit) */}
      <HomeMessages />

      {/* Weekly Leaders (current week) */}
      <WeeklyLeaders />

      {/* My Checkoff Progress + Recent Checkoffs */}
      <StandardsSection />
    </div>
  )
}

/* ===========================
   Weekly Leaders Widget
   =========================== */
function WeeklyLeaders(){
  const { user } = useAuth()
  const [week, setWeek] = useState(null)
  const [logs, setLogs] = useState([])
  const [err, setErr] = useState(null)

  // Get the most recent week (by startDate desc)
  useEffect(() => {
    const qy = query(collection(db, "weeklyChallenges"), orderBy("startDate", "desc"), limit(1))
    const unsub = onSnapshot(qy, snap => {
      const docSnap = snap.docs[0]
      if (!docSnap) { setWeek(null); setLogs([]); return }
      const w = { id: docSnap.id, ...(docSnap.data()||{}) }
      setWeek(w)

      // Subscribe to its logs
      const logsRef = collection(db, "weeklyChallenges", docSnap.id, "logs")
      const unsubLogs = onSnapshot(logsRef, lsnap => {
        const arr = lsnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
        setLogs(arr)
        setErr(null)
      }, e => setErr(e))
      return () => unsubLogs()
    }, e => setErr(e))
    return unsub
  }, [])

  // Aggregate totals per member + compute my/team totals
  const { leaders, myTotal, teamTotal, unit } = useMemo(() => {
    const byUser = new Map()
    let team = 0
    const unitStr = week?.unit || ""
    for (const l of logs) {
      const uid = l.uid || "unknown"
      const name = l.displayName || l.uid || "—"
      const v = Number(l.value) || 0
      team += v
      const cur = byUser.get(uid) || { uid, name, total: 0 }
      cur.total += v
      byUser.set(uid, cur)
    }
    const arr = [...byUser.values()].sort((a,b)=> b.total - a.total).slice(0, 10)
    const mine = byUser.get(user?.uid || "")?.total || 0
    return { leaders: arr, myTotal: mine, teamTotal: team, unit: unitStr }
  }, [logs, user, week])

  if (!week) {
    return (
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{justifyContent:"space-between"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
            <span className="badge">Weekly</span>
            <h3 style={{margin:0}}>Weekly Leaders</h3>
          </div>
          <span style={subtle}>No week found</span>
        </div>
        <div style={{color:"#cbd5e1"}}>Ask the owner to create the current week in <b>Weekly</b>.</div>
      </div>
    )
  }

  return (
    <div className="card vstack" style={{gap:14}}>
      <div className="hstack" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10}}>
        <div className="vstack" style={{gap:2}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
            <span className="badge">Weekly</span>
            <h3 style={{margin:0}}>Leaders — {week.title || "Current Week"}</h3>
            {week.unit && <span style={subtle}>Unit: {week.unit}</span>}
            {week.active === false && <span className="badge">archived</span>}
          </div>
        </div>

        {/* Big stats */}
        <div style={statWrap}>
          <div style={statCard}>
            <div style={statLabel}>My total</div>
            <div style={statValue}>
              {myTotal}{unit ? ` ${unit}` : ""}
            </div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Team total</div>
            <div style={statValue}>
              {teamTotal}{unit ? ` ${unit}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Leaders table */}
      {leaders.length === 0 ? (
        <div style={{color:"#9ca3af"}}>No logs yet this week.</div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Member</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((row, i) => (
                <tr key={row.uid}>
                  <td style={td}><b>{i+1}</b></td>
                  <td style={td}>{row.name}</td>
                  <td style={td}><b>{row.total}</b>{unit ? ` ${unit}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}

      <div className="hstack" style={{justifyContent:"flex-end"}}>
        <Link className="btn" to="/weekly">Open Weekly</Link>
      </div>
    </div>
  )
}

/* ===========================
   Standards Section
   - My Checkoff Progress (per tier + overall)
   - Recent Checkoffs (history feed)
   =========================== */
function StandardsSection(){
  const { user } = useAuth()
  const [standards, setStandards] = useState([])
  const [myCheckoffs, setMyCheckoffs] = useState([])
  const [history, setHistory] = useState([])
  const [err, setErr] = useState(null)

  // Fetch standards (for totals by tier)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "standards"), snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
      setStandards(arr)
    }, e => setErr(e))
    return unsub
  }, [])

  // Fetch my checkoffs
  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(collection(db, "profiles", user.uid, "checkoffs"), snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
      setMyCheckoffs(arr)
    }, e => setErr(e))
    return unsub
  }, [user?.uid])

  // Recent checkoff history (everyone)
  useEffect(() => {
    const qy = query(collectionGroup(db, "history"), orderBy("createdAt", "desc"), limit(8))
    const unsub = onSnapshot(qy, snap => {
      const arr = snap.docs.map(d => {
        // path: profiles/{uid}/checkoffs/{standardId}/history/{eventId}
        const p = d.ref.path.split("/")
        const uid = p[1]
        const standardId = p[3]
        return { id: d.id, uid, standardId, ...(d.data()||{}) }
      })
      setHistory(arr)
    }, e => setErr(e))
    return unsub
  }, [])

  // Compute progress by tier + overall
  const tiers = ["committed", "developmental", "advanced", "elite"]
  const progress = useMemo(() => {
    const byTierTotal = Object.fromEntries(tiers.map(t => [t, 0]))
    const byTierChecked = Object.fromEntries(tiers.map(t => [t, 0]))

    // normalize helper
    const norm = (s) => (s || "").toString().trim().toLowerCase()

    for (const s of standards) {
      const t = norm(s.tier)
      if (byTierTotal[t] != null) byTierTotal[t]++
    }
    const checkedSet = new Set(
      myCheckoffs.filter(c => c.checked).map(c => c.id) // ids are standardId
    )
    for (const s of standards) {
      const t = norm(s.tier)
      if (byTierChecked[t] != null && checkedSet.has(s.id)) byTierChecked[t]++
    }

    const rows = tiers.map(t => {
      const total = byTierTotal[t] || 0
      const done = byTierChecked[t] || 0
      const pct = total ? Math.round((done / total) * 100) : 0
      return { tier: t, done, total, pct }
    })

    const overallTotal = standards.length
    const overallDone = standards.filter(s => checkedSet.has(s.id)).length
    const overallPct = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0

    return { rows, overall: { done: overallDone, total: overallTotal, pct: overallPct } }
  }, [standards, myCheckoffs])

  return (
    <div className="vstack" style={{gap:12}}>
      {/* My Checkoff Progress */}
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
            <span className="badge">Standards</span>
            <h3 style={{margin:0}}>My Checkoff Progress</h3>
          </div>
          <Link className="btn" to="/checkoffs">Open Checkoffs</Link>
        </div>

        {/* Overall */}
        <div className="vstack" style={{gap:6}}>
          <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline"}}>
            <div style={{fontWeight:700}}>Overall</div>
            <div style={subtle}>{progress.overall.done}/{progress.overall.total} — {progress.overall.pct}%</div>
          </div>
          <div style={barWrap}><div style={barFill(progress.overall.pct)} /></div>
        </div>

        {/* Per tier */}
        <div className="vstack" style={{gap:10}}>
          {progress.rows.map(r => (
            <div key={r.tier} className="vstack" style={{gap:6}}>
              <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline"}}>
                <div style={{textTransform:"capitalize"}}>{r.tier}</div>
                <div style={subtle}>{r.done}/{r.total} — {r.pct}%</div>
              </div>
              <div style={barWrap}><div style={barFill(r.pct)} /></div>
            </div>
          ))}
          {progress.rows.every(r => r.total === 0) && (
            <div style={{color:"#9ca3af"}}>No standards defined yet. Add them in <b>Standards</b>.</div>
          )}
        </div>

        {err && (
          <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
            Error: {String(err.message || err)}
          </div>
        )}
      </div>

      {/* Recent Checkoffs (keep) */}
      <div className="card vstack" style={{gap:8}}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
            <span className="badge">Standards</span>
            <h3 style={{margin:0}}>Recent Checkoffs</h3>
          </div>
          <Link className="btn" to="/checkoffs">Open Checkoffs</Link>
        </div>

        {history.length === 0 ? (
          <div style={{color:"#9ca3af"}}>No recent checkoffs.</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Member</th>
                  <th style={th}>Standard</th>
                  <th style={th}>Action</th>
                  <th style={th}>By</th>
                  <th style={th}>When</th>
                  <th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={td}>{h.memberName || h.uid || "—"}</td>
                    <td style={td}>{h.standardTitle || h.standardId || "—"}</td>
                    <td style={td}>{h.action || (h.checked ? "checked" : "updated")}</td>
                    <td style={td}>{h.byName || h.checkedByName || "—"}</td>
                    <td style={td}>{h.createdAt?.toDate?.()?.toLocaleString?.() || "—"}</td>
                    <td style={td}>{h.note || h.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
