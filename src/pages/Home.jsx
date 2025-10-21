// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  collection, doc, getDoc, getDocs,
  onSnapshot, orderBy, query, limit, serverTimestamp, setDoc
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

// Week helpers
function isoWeekIdOf(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1))
  const weekNo = Math.ceil((((date - yearStart)/86400000) + 1) / 7)
  const ww = String(weekNo).padStart(2, "0")
  return `${date.getUTCFullYear()}-W${ww}`
}
function previousIsoWeekId(){
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return isoWeekIdOf(d)
}

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

      {/* Announcements / Messages */}
      <HomeMessages />

      {/* Weekly Champion (previous week, owner can edit / auto-fill) */}
      <ChampionBanner />

      {/* Weekly Leaders (current week) */}
      <WeeklyLeaders />
    </div>
  )
}

/* ===========================
   Weekly Champion Banner
   =========================== */
function ChampionBanner(){
  const { user, profile } = useAuth()
  const [superOwner, setSuperOwner] = useState(false)
  const ownerLike = (profile?.role === "owner") || superOwner

  useEffect(() => {
    async function checkSuper(){
      if (!user) { setSuperOwner(false); return }
      try {
        const snap = await getDoc(doc(db, "settings", "owners"))
        const uids = snap.exists() ? (snap.data()?.uids || []) : []
        setSuperOwner(Array.isArray(uids) && uids.includes(user.uid))
      } catch { setSuperOwner(false) }
    }
    checkSuper()
  }, [user?.uid])

  const [busy, setBusy] = useState(true)
  const [champ, setChamp] = useState(null)
  const [form, setForm] = useState({
    weekId: previousIsoWeekId(),
    leaderName: "",
    leaderUid: "",
    value: "",
    metric: "points",
    notes: "",
    imageUrl: ""
  })

  useEffect(() => { loadChampion() }, [])
  async function loadChampion(){
    setBusy(true)
    try {
      const snap = await getDoc(doc(db, "settings", "champion"))
      if (snap.exists()) {
        const c = snap.data()
        setChamp(c)
        setForm(f => ({
          ...f,
          weekId: c.weekId || previousIsoWeekId(),
          leaderName: c.leaderName || "",
          leaderUid: c.leaderUid || "",
          value: c.value ?? "",
          metric: c.metric || "points",
          notes: c.notes || "",
          imageUrl: c.imageUrl || ""
        }))
      } else {
        setChamp(null)
      }
    } finally { setBusy(false) }
  }

  async function saveChampion(){
    if (!ownerLike) return
    const valueNum = form.value === "" ? null : Number(form.value)
    if (form.value !== "" && !Number.isFinite(valueNum)) { alert("Value must be a number (or blank)."); return }
    setBusy(true)
    try {
      await setDoc(doc(db, "settings", "champion"), {
        weekId: (form.weekId || "").trim(),
        leaderName: (form.leaderName || "").trim(),
        leaderUid: (form.leaderUid || "").trim() || null,
        value: valueNum,
        metric: (form.metric || "points").trim(),
        notes: (form.notes || "").trim(),
        imageUrl: (form.imageUrl || "").trim(),
        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid || null,
        updatedByName: profile?.displayName || user?.email || "owner"
      }, { merge: true })
      await loadChampion()
      alert("Champion saved.")
    } finally { setBusy(false) }
  }

  async function autofillFromWeek(){
    if (!ownerLike) return
    const weekId = (form.weekId || "").trim()
    if (!weekId) { alert("Enter a week ID (e.g., 2025-W42)."); return }

    setBusy(true)
    try {
      const logsRef = collection(db, "weeklyChallenges", weekId, "logs")
      const snap = await getDocs(query(logsRef, orderBy("createdAt")))
      if (snap.empty) { alert(`No logs found for ${weekId}.`); return }

      const totalsByUid = new Map()
      const nameByUid = new Map()
      const totalsByName = new Map()

      snap.forEach(d => {
        const x = d.data() || {}
        const v = Number(x.value) || 0
        const uid = (x.uid || "").toString()
        const name = (x.displayName || "").toString()
        if (uid) {
          totalsByUid.set(uid, (totalsByUid.get(uid) || 0) + v)
          if (name) nameByUid.set(uid, name)
        } else if (name) {
          totalsByName.set(name, (totalsByName.get(name) || 0) + v)
        }
      })

      let leaderUid = ""
      let leaderName = ""
      let best = -Infinity
      for (const [uid, total] of totalsByUid.entries()) {
        if (total > best) { best = total; leaderUid = uid; leaderName = nameByUid.get(uid) || uid }
      }
      if (leaderUid === "") {
        for (const [name, total] of totalsByName.entries()) {
          if (total > best) { best = total; leaderName = name }
        }
      }
      if (best === -Infinity) { alert(`No numeric values in logs for ${weekId}.`); return }

      setForm(f => ({ ...f, leaderUid, leaderName, value: String(best) }))
      alert(`Auto-filled: ${leaderName} with ${best} ${form.metric || "points"}. Click Save.`)
    } finally { setBusy(false) }
  }

  return (
    <div className="card vstack" style={{gap:10}}>
      <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:8}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
          <span className="badge">Weekly</span>
          <h3 style={{margin:0}}>Champion (previous week)</h3>
        </div>
        {ownerLike && (
          <div className="hstack" style={{gap:8}}>
            <button className="btn" onClick={autofillFromWeek} disabled={busy}>{busy ? "…" : "Auto-fill"}</button>
            <button className="btn" onClick={saveChampion} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        )}
      </div>

      {busy ? (
        <div>Loading…</div>
      ) : champ ? (
        <div className="hstack" style={{gap:16, alignItems:"center", flexWrap:"wrap"}}>
          {champ.imageUrl ? (
            <img src={champ.imageUrl} alt="Champion" style={{width:88, height:88, objectFit:"cover", borderRadius:12, border:"1px solid #1f2937"}} />
          ) : null}
          <div className="vstack" style={{gap:4}}>
            <div style={{fontSize:18, fontWeight:800}}>{champ.leaderName || "—"}</div>
            <div style={subtle}>
              Week: <b style={{color:"#e5e7eb"}}>{champ.weekId || "—"}</b>
              {champ.value != null ? <> · {champ.value} {champ.metric || "points"}</> : null}
            </div>
            {champ.notes ? <div style={{color:"#cbd5e1"}}>{champ.notes}</div> : null}
          </div>
        </div>
      ) : (
        <div style={subtle}>No champion set yet.</div>
      )}

      {ownerLike && (
        <div className="vstack" style={{gap:8}}>
          <div className="grid" style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
            <LabeledInput label="Week ID (YYYY-Www)" value={form.weekId} onChange={v=>setForm(f=>({...f, weekId:v}))} placeholder={previousIsoWeekId()} />
            <LabeledInput label="Leader name" value={form.leaderName} onChange={v=>setForm(f=>({...f, leaderName:v}))} placeholder="e.g., Alex G." />
            <LabeledInput label="Leader UID (optional)" value={form.leaderUid} onChange={v=>setForm(f=>({...f, leaderUid:v}))} placeholder="user uid" />
            <LabeledInput label="Total value" value={form.value} onChange={v=>setForm(f=>({...f, value:v}))} placeholder="e.g., 320" inputMode="decimal" />
            <LabeledInput label="Metric" value={form.metric} onChange={v=>setForm(f=>({...f, metric:v}))} placeholder="points, reps…" />
            <LabeledInput label="Image URL (optional)" value={form.imageUrl} onChange={v=>setForm(f=>({...f, imageUrl:v}))} placeholder="https://…" />
          </div>
          <div className="vstack" style={{gap:6}}>
            <label style={subtle}>Notes</label>
            <textarea
              rows={2}
              style={{width:"100%", background:"#0b1426", border:"1px solid #1f2937", borderRadius:10, color:"#e5e7eb", padding:10}}
              value={form.notes}
              onChange={e=>setForm(f=>({...f, notes:e.target.value}))}
              placeholder="Shoutouts, tie-breakers, etc."
            />
          </div>
        </div>
      )}
    </div>
  )
}

function LabeledInput({ label, value, onChange, placeholder, inputMode }){
  return (
    <div className="vstack" style={{gap:6}}>
      <label style={subtle}>{label}</label>
      <input
        style={{width:"100%", background:"#0b1426", border:"1px solid #1f2937", borderRadius:10, color:"#e5e7eb", padding:"10px 12px"}}
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
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

  useEffect(() => {
    const qy = query(collection(db, "weeklyChallenges"), orderBy("startDate", "desc"), limit(1))
    const unsub = onSnapshot(qy, snap => {
      const docSnap = snap.docs[0]
      if (!docSnap) { setWeek(null); setLogs([]); return }
      const w = { id: docSnap.id, ...(docSnap.data()||{}) }
      setWeek(w)
      const logsRef = collection(db, "weeklyChallenges", docSnap.id, "logs")
      const unsubLogs = onSnapshot(logsRef, lsnap => {
        const arr = lsnap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
        setLogs(arr); setErr(null)
      }, e => setErr(e))
      return () => unsubLogs()
    }, e => setErr(e))
    return unsub
  }, [])

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
            <div style={statValue}>{myTotal}{unit ? ` ${unit}` : ""}</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Team total</div>
            <div style={statValue}>{teamTotal}{unit ? ` ${unit}` : ""}</div>
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
