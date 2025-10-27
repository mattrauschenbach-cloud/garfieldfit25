// src/pages/Weekly.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  limit, onSnapshot, orderBy, query, serverTimestamp,
  setDoc, updateDoc
} from "firebase/firestore"

/* ---------- tiny style helpers to match your theme ---------- */
const subtle = { color:"#9ca3af", fontSize:12 }
const muted = { color:"#cbd5e1" }
const card = { border:"1px solid #1f2937", background:"#0f1a30", borderRadius:14, padding:14 }
const section = { display:"grid", gap:12 }
const inputStyle = { width:"100%", background:"#0b1426", border:"1px solid #1f2937", borderRadius:10, color:"#e5e7eb", padding:"10px 12px" }
const btn = "btn"

function Labeled({ label, children }) {
  return (
    <div className="vstack" style={{gap:6}}>
      <label style={subtle}>{label}</label>
      {children}
    </div>
  )
}

/* ---------- week id helpers (YYYY-Www) ---------- */
function isoWeekIdOf(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1))
  const weekNo = Math.ceil((((date - yearStart)/86400000) + 1) / 7)
  const ww = String(weekNo).padStart(2, "0")
  return `${date.getUTCFullYear()}-W${ww}`
}
function currentIsoWeekId(){ return isoWeekIdOf(new Date()) }

/* ===========================================================
   Page
   =========================================================== */
export default function Weekly(){
  const { user, profile } = useAuth()
  const isOwner = profile?.role === "owner" // mentors/admins still log/edit where allowed by rules

  // current week document
  const [weekId, setWeekId] = useState(currentIsoWeekId())
  const [week, setWeek] = useState(null)
  const [busyWeek, setBusyWeek] = useState(false)
  const [errWeek, setErrWeek] = useState(null)

  // logs for current week
  const [logs, setLogs] = useState([])
  const [errLogs, setErrLogs] = useState(null)

  // form to create/update week (owner)
  const [wform, setWform] = useState({
    title: "",
    unit: "points",
    description: "",
    startDate: "", // yyyy-mm-dd (display only)
    endDate: "",
    active: true,
  })

  // my new log form
  const [lf, setLf] = useState({ value:"", note:"" })
  const canLog = !!user

  /* ---- load (or watch) the chosen week's doc ---- */
  useEffect(() => {
    if (!weekId) return
    setErrWeek(null)
    const ref = doc(db, "weeklyChallenges", weekId)
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const w = { id: snap.id, ...(snap.data()||{}) }
        setWeek(w)
        setWform(f => ({
          ...f,
          title: w.title || "",
          unit: w.unit || "points",
          description: w.description || "",
          startDate: w.startDate?.toDate?.()?.toISOString?.().slice(0,10) || "",
          endDate: w.endDate?.toDate?.()?.toISOString?.().slice(0,10) || "",
          active: w.active !== false
        }))
      } else {
        setWeek(null)
        // leave form as-is so owner can create
      }
    }, e => setErrWeek(e))
    return unsub
  }, [weekId])

  /* ---- watch logs for the selected week ---- */
  useEffect(() => {
    if (!weekId) { setLogs([]); return }
    setErrLogs(null)
    const ref = collection(db, "weeklyChallenges", weekId, "logs")
    const qy = query(ref, orderBy("createdAt", "desc"), limit(200))
    const unsub = onSnapshot(
      qy,
      snap => setLogs(snap.docs.map(d => ({ id:d.id, ...(d.data()||{}) }))),
      e => setErrLogs(e)
    )
    return unsub
  }, [weekId])

  /* ---- aggregate leaders ---- */
  const { leaders, myTotal, teamTotal, unit } = useMemo(() => {
    const byUser = new Map()
    let team = 0
    const unitStr = week?.unit || "points"
    for (const l of logs) {
      const uid = l.uid || "unknown"
      const name = l.displayName || l.uid || "—"
      const v = Number(l.value) || 0
      team += v
      const cur = byUser.get(uid) || { uid, name, total:0 }
      cur.total += v
      byUser.set(uid, cur)
    }
    const arr = [...byUser.values()].sort((a,b)=> b.total - a.total).slice(0, 15)
    const mine = byUser.get(user?.uid || "")?.total || 0
    return { leaders: arr, myTotal: mine, teamTotal: team, unit: unitStr }
  }, [logs, user, week])

  /* ---------- owner: create/update week ---------- */
  async function saveWeek(){
    if (!isOwner) return
    setBusyWeek(true)
    try {
      const ref = doc(db, "weeklyChallenges", weekId.trim())
      // Firestore server timestamps for start/end aren't great—store ISO dates as strings too for stability
      await setDoc(ref, {
        title: (wform.title || "").trim() || `Week ${weekId}`,
        unit: (wform.unit || "points").trim(),
        description: (wform.description || "").trim(),
        startDateText: (wform.startDate || "").trim(),
        endDateText: (wform.endDate || "").trim(),
        active: !!wform.active,
        updatedAt: serverTimestamp(),
      }, { merge:true })
      alert("Week saved.")
    } finally { setBusyWeek(false) }
  }

  async function setCurrentWeek(){
    setWeekId(currentIsoWeekId())
  }

  /* ---------- members: add/delete logs ---------- */
  async function addLog(){
    if (!canLog || !weekId) return
    const value = Number(lf.value)
    if (!Number.isFinite(value)) { alert("Enter a numeric value."); return }
    const ref = collection(db, "weeklyChallenges", weekId, "logs")
    await addDoc(ref, {
      uid: user.uid,
      displayName: profile?.displayName || user.email || "Member",
      value,
      note: (lf.note || "").trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setLf({ value:"", note:"" })
  }

  async function deleteLog(id, uid){
    if (!user) return
    if (uid !== user.uid && profile?.role !== "owner" && !["mentor","admin"].includes(profile?.role)) {
      alert("You can only delete your own logs.")
      return
    }
    if (!confirm("Delete this log?")) return
    await deleteDoc(doc(db, "weeklyChallenges", weekId, "logs", id))
  }

  const myLogs = useMemo(() => logs.filter(l => l.uid === user?.uid), [logs, user?.uid])

  return (
    <div className="container vstack" style={{gap:12}}>
      {/* Title row */}
      <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:10}}>
        <div className="vstack" style={{gap:4}}>
          <span className="badge">Weekly</span>
          <h2 style={{margin:0}}>Weekly Challenge</h2>
          <div style={subtle}>Week ID</div>
          <div className="hstack" style={{gap:8, alignItems:"center", flexWrap:"wrap"}}>
            <input style={inputStyle} value={weekId} onChange={e=>setWeekId(e.target.value)} />
            <button className={btn} onClick={setCurrentWeek}>This Week</button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="hstack" style={{gap:12, flexWrap:"wrap"}}>
          <Stat label="My total" value={myTotal} unit={unit} />
          <Stat label="Team total" value={teamTotal} unit={unit} />
        </div>
      </div>

      {/* Owner editor */}
      {isOwner && (
        <div style={card}>
          <div className="hstack" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap"}}>
            <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
              <span className="badge">Owner</span>
              <h3 style={{margin:0}}>Edit / Create Week</h3>
            </div>
            <button className={btn} onClick={saveWeek} disabled={busyWeek}>{busyWeek ? "Saving…" : "Save"}</button>
          </div>

          {errWeek && <div style={{marginTop:8, color:"#fecaca"}}>Error: {String(errWeek.message || errWeek)}</div>}

          <div style={{...section, marginTop:10}}>
            <div className="grid" style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
              <Labeled label="Title">
                <input style={inputStyle} value={wform.title} onChange={e=>setWform(f=>({...f, title:e.target.value}))} placeholder={`Week ${weekId}`} />
              </Labeled>
              <Labeled label="Unit">
                <input style={inputStyle} value={wform.unit} onChange={e=>setWform(f=>({...f, unit:e.target.value}))} placeholder="points / miles / reps…" />
              </Labeled>
              <Labeled label="Start date (display)">
                <input type="date" style={inputStyle} value={wform.startDate} onChange={e=>setWform(f=>({...f, startDate:e.target.value}))} />
              </Labeled>
              <Labeled label="End date (display)">
                <input type="date" style={inputStyle} value={wform.endDate} onChange={e=>setWform(f=>({...f, endDate:e.target.value}))} />
              </Labeled>
              <Labeled label="Active?">
                <select style={inputStyle} value={wform.active ? "yes":"no"} onChange={e=>setWform(f=>({...f, active: e.target.value === "yes"}))}>
                  <option value="yes">Yes</option>
                  <option value="no">No (archived)</option>
                </select>
              </Labeled>
            </div>
            <Labeled label="Description">
              <textarea rows={3} style={inputStyle} value={wform.description} onChange={e=>setWform(f=>({...f, description:e.target.value}))} placeholder="Short blurb about the challenge…" />
            </Labeled>
            {week?.description && <div style={muted}>Live: {week.description}</div>}
          </div>
        </div>
      )}

      {/* Log form */}
      <div style={card}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
            <span className="badge">Log</span>
            <h3 style={{margin:0}}>Add Entry</h3>
          </div>
        </div>

        {errLogs && <div style={{marginTop:8, color:"#fecaca"}}>Error: {String(errLogs.message || errLogs)}</div>}

        {!canLog ? (
          <div style={{marginTop:8}}>Please sign in to log your progress.</div>
        ) : (
          <div className="grid" style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", marginTop:10}}>
            <Labeled label={`Value (${unit || "points"})`}>
              <input style={inputStyle} value={lf.value} onChange={e=>setLf(f=>({...f, value:e.target.value}))} inputMode="decimal" placeholder="e.g., 3.2" />
            </Labeled>
            <Labeled label="Note (optional)">
              <input style={inputStyle} value={lf.note} onChange={e=>setLf(f=>({...f, note:e.target.value}))} placeholder="What did you do?" />
            </Labeled>
            <div className="vstack" style={{gap:6}}>
              <label style={{visibility:"hidden"}}>.</label>
              <button className={btn} onClick={addLog} disabled={!lf.value}>Add log</button>
            </div>
          </div>
        )}
      </div>

      {/* My logs (quick manage) */}
      {canLog && (
        <div style={card}>
          <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline"}}>
            <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
              <span className="badge">Me</span>
              <h3 style={{margin:0}}>My Logs</h3>
            </div>
            <div style={subtle}>{myLogs.length} items</div>
          </div>
          {myLogs.length === 0 ? (
            <div style={muted}>No logs yet this week.</div>
          ) : (
            <div className="vstack" style={{gap:8, marginTop:8}}>
              {myLogs.map(l => (
                <div key={l.id} className="hstack" style={{justifyContent:"space-between", gap:10, flexWrap:"wrap", border:"1px solid #1f2937", borderRadius:10, padding:"10px 12px"}}>
                  <div className="vstack" style={{gap:2}}>
                    <div style={{fontWeight:700}}>{l.value} {unit}</div>
                    {l.note ? <div style={subtle}>{l.note}</div> : null}
                    <div style={subtle}>{l.createdAt?.toDate?.()?.toLocaleString?.() || ""}</div>
                  </div>
                  <div className="hstack" style={{gap:8}}>
                    <button className="btn btn-danger" onClick={()=>deleteLog(l.id, l.uid)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Week leaderboard */}
      <div style={card}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
            <span className="badge">Weekly</span>
            <h3 style={{margin:0}}>Leaderboard — {week?.title || `Week ${weekId}`}</h3>
          </div>
          <div style={subtle}>Top {Math.min(15, leaders.length)}</div>
        </div>

        {leaders.length === 0 ? (
          <div style={muted}>No logs yet.</div>
        ) : (
          <div style={{overflowX:"auto", marginTop:8}}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Member</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row, i) => (
                  <tr key={row.uid} >
                    <Td><b>{i+1}</b></Td>
                    <Td>{row.name}</Td>
                    <Td><b>{row.total}</b> {unit}</Td>
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

/* ---------- small table cells ---------- */
function Th({ children }) {
  return <th style={{ textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af", borderBottom:"1px solid #1f2937", background:"#0f1a30" }}>{children}</th>
}
function Td({ children }) {
  return <td style={{ padding:"10px 12px", borderBottom:"1px solid #1f2937" }}>{children}</td>
}

/* ---------- compact stat ---------- */
function Stat({ label, value, unit }) {
  return (
    <div className="vstack" style={{gap:6, minWidth:160, border:"1px solid #1f2937", background:"#0f1a30", borderRadius:14, padding:"14px 16px"}}>
      <div style={subtle}>{label}</div>
      <div style={{ fontSize:28, fontWeight:800, lineHeight:1, color:"#e5e7eb" }}>
        {value}{unit ? ` ${unit}` : ""}
      </div>
    </div>
  )
}
