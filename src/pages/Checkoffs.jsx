// src/pages/Checkoffs.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  collection, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc
} from "firebase/firestore"

const TIERS = ["committed", "developmental", "advanced", "elite"]

// simple progress bar
function ProgressBar({ value = 0, max = 1, label }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="vstack" style={{gap:6, minWidth:240}}>
      {label && <div className="hstack" style={{justifyContent:"space-between"}}>
        <span style={{color:"#9ca3af"}}>{label}</span>
        <span style={{color:"#9ca3af"}}>{value}/{max} ({pct}%)</span>
      </div>}
      <div style={{
        height:10, borderRadius:999, background:"#111827", border:"1px solid #1f2937", overflow:"hidden"
      }}>
        <div style={{
          width: `${pct}%`, height:"100%", borderRadius:999,
          background: "linear-gradient(90deg, #2563eb, #22d3ee)"
        }}/>
      </div>
    </div>
  )
}

export default function Checkoffs(){
  const { user, profile } = useAuth()
  const isMentor = ["mentor","admin","owner"].includes(profile?.role || "member")

  // member picker (mentors/admin/owner can switch; others see self)
  const [members, setMembers] = useState([])
  const [targetUid, setTargetUid] = useState(null)

  // standards + check states
  const [standards, setStandards] = useState([])
  const [checks, setChecks] = useState({}) // { standardId: true/false }
  const [tierFilter, setTierFilter] = useState("all")
  const [q, setQ] = useState("")
  const [err, setErr] = useState(null)

  // load members for selector
  useEffect(() => {
    if (!isMentor) { setMembers([]); setTargetUid(user?.uid || null); return }
    const unsub = onSnapshot(
      query(collection(db, "profiles"), orderBy("displayName")),
      snap => {
        const arr = snap.docs.map(d => ({ id:d.id, ...(d.data()) }))
        setMembers(arr)
        if (!targetUid && user) setTargetUid(user.uid)
      },
      e => setErr(e)
    )
    return unsub
  }, [isMentor, user, targetUid])

  // default to me for non-mentors
  useEffect(() => {
    if (!isMentor && user && !targetUid) setTargetUid(user.uid)
  }, [isMentor, user, targetUid])

  // standards list
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "standards"), orderBy("tier"), orderBy("category"), orderBy("title")),
      snap => setStandards(snap.docs.map(d => ({ id:d.id, ...d.data() }))),
      e => setErr(e)
    )
    return unsub
  }, [])

  // checkoffs for selected uid
  useEffect(() => {
    if (!targetUid) return
    const unsub = onSnapshot(
      collection(db, "profiles", targetUid, "checkoffs"),
      snap => {
        const map = {}
        snap.forEach(d => map[d.id] = !!d.data().done)
        setChecks(map)
      },
      e => setErr(e)
    )
    return unsub
  }, [targetUid])

  // visible list for the table (respects filters)
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return standards
      .filter(s => s.active !== false)
      .filter(s => tierFilter === "all" ? true : (s.tier === tierFilter))
      .filter(s => !ql ? true :
        (s.title || "").toLowerCase().includes(ql) ||
        (s.category || "").toLowerCase().includes(ql)
      )
  }, [standards, tierFilter, q])

  // progress math (always uses ALL active standards, not just filtered)
  const activeByTier = useMemo(() => {
    const obj = Object.fromEntries(TIERS.map(t => [t, []]))
    standards.forEach(s => {
      if (s.active === false) return
      const t = s.tier || "committed"
      if (!obj[t]) obj[t] = []
      obj[t].push(s)
    })
    return obj
  }, [standards])

  const progress = useMemo(() => {
    const tierStats = {}
    let totalMax = 0, totalVal = 0
    for (const t of TIERS) {
      const list = activeByTier[t] || []
      const max = list.length
      const val = list.reduce((a, s) => a + (checks[s.id] ? 1 : 0), 0)
      tierStats[t] = { val, max }
      totalMax += max
      totalVal += val
    }
    return { tierStats, total: { val: totalVal, max: totalMax } }
  }, [activeByTier, checks])

  const doneCount = filtered.reduce((a, s) => a + (checks[s.id] ? 1 : 0), 0)

  async function toggle(standardId, next){
    if (!targetUid) return
    try{
      await setDoc(
        doc(db, "profiles", targetUid, "checkoffs", standardId),
        { done: next, updatedAt: serverTimestamp() },
        { merge: true }
      )
    }catch(e){
      alert(`Failed to save: ${e.code || e.message}`)
    }
  }

  return (
    <div className="container vstack">
      {/* Header & controls */}
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <span className="badge">Checkoffs</span>
            <span className="badge">Visible done: <b>{doneCount}</b>/<b>{filtered.length}</b></span>
          </div>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <input
              placeholder="Search title/category"
              value={q}
              onChange={e=>setQ(e.target.value)}
              style={{background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
                      borderRadius:8, padding:"8px 10px", minWidth:200}}
            />
            <select value={tierFilter} onChange={e=>setTierFilter(e.target.value)} style={select}>
              <option value="all">All tiers</option>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {isMentor && (
              <select
                value={targetUid || ""}
                onChange={e=>setTargetUid(e.target.value)}
                style={select}
                title="Member"
              >
                <option value="" disabled>Select member…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.displayName || m.id}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Progress bars */}
        <div className="vstack" style={{gap:10, marginTop:10}}>
          <ProgressBar value={progress.total.val} max={progress.total.max} label="Overall progress" />
          <div className="hstack" style={{gap:16, flexWrap:"wrap"}}>
            {TIERS.map(t => (
              <ProgressBar
                key={t}
                value={progress.tierStats[t]?.val || 0}
                max={progress.tierStats[t]?.max || 0}
                label={`${t} tier`}
              />
            ))}
          </div>
        </div>

        {!isMentor && (
          <p style={{color:"#9ca3af", margin:0, fontSize:13, marginTop:6}}>
            You’re viewing your own checkoffs.
          </p>
        )}
      </div>

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}

      {/* List */}
      <div className="card vstack">
        {filtered.length === 0 ? (
          <p style={{color:"#9ca3af"}}>No standards yet.</p>
        ) : (
          <ul className="vstack" style={{listStyle:"none", margin:0, padding:0}}>
            {filtered.map(s => (
              <li key={s.id} className="hstack" style={{justifyContent:"space-between", borderBottom:"1px solid #1f2937", padding:"8px 0"}}>
                <div className="vstack" style={{gap:4}}>
                  <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
                    <b>{s.title}</b>
                    <span className="badge">{s.tier}</span>
                    {s.category && <span className="badge">{s.category}</span>}
                  </div>
                </div>
                <label className="hstack" style={{gap:8}}>
                  <input
                    type="checkbox"
                    checked={!!checks[s.id]}
                    onChange={e=>toggle(s.id, e.target.checked)}
                  />
                  <span>{checks[s.id] ? "Done" : "Not done"}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const select = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:8, padding:"8px 10px", minWidth:160
}
