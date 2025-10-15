// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  collection, collectionGroup, doc, onSnapshot, orderBy, query, limit
} from "firebase/firestore"
import HomeMessages from "../components/HomeMessages"

// Small style helpers to match your theme
const subtle = { color:"#9ca3af", fontSize:12 }
const table = { width:"100%", borderCollapse:"collapse" }
const th = { textAlign:"left", padding:"8px 10px", fontSize:12, color:"#9ca3af", borderBottom:"1px solid #1f2937", background:"#0f1a30" }
const td = { padding:"8px 10px", borderBottom:"1px solid #1f2937" }

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

      {/* Weekly snapshot (current/most recent week) */}
      <WeeklySnapshot />

      {/* Standards updates (recent records + recent checkoff history) */}
      <StandardsUpdates />
    </div>
  )
}

/* ===========================
   Weekly Snapshot Widget
   =========================== */
function WeeklySnapshot(){
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

  // Totals
  const { myTotal, teamTotal } = useMemo(() => {
    let my = 0, team = 0
    const myUid = user?.uid
    for (const l of logs) {
      const v = Number(l.value) || 0
      team += v
      if (l.uid === myUid) my += v
    }
    return { myTotal: my, teamTotal: team }
  }, [logs, user])

  if (!week) {
    return (
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{justifyContent:"space-between"}}>
          <span className="badge">Weekly</span>
          <span style={subtle}>No week found</span>
        </div>
        <div style={{color:"#cbd5e1"}}>Ask the owner to create the current week in <b>Weekly</b>.</div>
      </div>
    )
  }

  const recent = [...logs]
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
    .slice(0, 8)

  return (
    <div className="card vstack" style={{gap:10}}>
      <div className="hstack" style={{justifyContent:"space-between", alignItems:"center"}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Weekly</span>
          <h3 style={{margin:0}}>{week.title || "Current Week"}</h3>
          {week.unit && <span style={subtle}>Unit: {week.unit}</span>}
          {week.active === false && <span className="badge">archived</span>}
        </div>
        <div className="hstack" style={{gap:10}}>
          <div className="badge">My total: <b>{myTotal}</b></div>
          <div className="badge">Team total: <b>{teamTotal}</b></div>
        </div>
      </div>

      {/* Recent log rows */}
      {recent.length === 0 ? (
        <div style={{color:"#9ca3af"}}>No logs yet this week.</div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Member</th>
                <th style={th}>Value</th>
                <th style={th}>Note</th>
                <th style={th}>When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.displayName || r.uid || "—"}</td>
                  <td style={td}>{r.value}</td>
                  <td style={td}>{r.note || "—"}</td>
                  <td style={td}>{r.createdAt?.toDate?.()?.toLocaleString?.() || "—"}</td>
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
    </div>
  )
}

/* ===========================
   Standards Updates Widget
   =========================== */
function StandardsUpdates(){
  const [records, setRecords] = useState([])       // recent record updates
  const [history, setHistory] = useState([])       // recent checkoff events
  const [err, setErr] = useState(null)

  // Recent record updates (from /standards/{id}/record/{recId})
  useEffect(() => {
    // Collection group by 'record' (single-field orderBy is fine)
    const qy = query(collectionGroup(db, "record"), orderBy("updatedAt", "desc"), limit(6))
    const unsub = onSnapshot(qy, snap => {
      const arr = snap.docs.map(d => {
        const path = d.ref.path.split("/") // standards/{stdId}/record/{recId}
        const standardId = path[1]
        return { id: d.id, standardId, ...(d.data()||{}) }
      })
      setRecords(arr)
      setErr(null)
    }, e => setErr(e))
    return unsub
  }, [])

  // Recent checkoff history (collectionGroup on 'history')
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
      setErr(null)
    }, e => setErr(e))
    return unsub
  }, [])

  return (
    <div className="vstack" style={{gap:12}}>
      {/* Records block */}
      <div className="card vstack" style={{gap:8}}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
            <span className="badge">Standards</span>
            <h3 style={{margin:0}}>Recent Records</h3>
          </div>
          <Link className="btn" to="/leaderboard">Open Leaderboard</Link>
        </div>

        {records.length === 0 ? (
          <div style={{color:"#9ca3af"}}>No record updates yet.</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Standard</th>
                  <th style={th}>Holder</th>
                  <th style={th}>Record</th>
                  <th style={th}>Verified by</th>
                  <th style={th}>When</th>
                  <th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td style={td}>{r.standardTitle || r.standardId || "—"}</td>
                    <td style={td}>{r.holderName || r.holderUid || "—"}</td>
                    <td style={td}>{r.value != null ? `${r.value} ${r.unit || ""}` : "—"}</td>
                    <td style={td}>{r.verifiedByName || "—"}</td>
                    <td style={td}>{r.updatedAt?.toDate?.()?.toLocaleString?.() || "—"}</td>
                    <td style={td}>{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Checkoff history block */}
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

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}
    </div>
  )
}
