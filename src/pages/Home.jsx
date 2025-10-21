// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  collection, collectionGroup, doc, getDoc, getDocs,
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

// Progress bar styles
const barWrap = { width:"100%", background:"#0b1426", border:"1px solid #1f2937", borderRadius:10, height:16, overflow:"hidden" }
const barFill = (pct)=>({ width:`${pct}%`, height:"100%", background:"#1f6feb", transition:"width .25s ease" })

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

      {/* Announcements / Messages (staff can post/edit) */}
      <HomeMessages />

      {/* Weekly Champion (previous week, owner can edit / auto-fill) */}
      <ChampionBanner />

      {/* Weekly Leaders (current week) */}
      <WeeklyLeaders />

      {/* My Checkoff Progress + Recent Checkoffs */}
      <StandardsSection />
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
            <div className="vstack" style={{gap:6}}>
              <label style={subtle}>Week ID (YYYY-Www)</label>
              <input
                style={barWrap}
                value={form.weekId}
                onChange={e=>setForm(f=>({...f, weekId: e.target.value}))}
                placeholder={previousIsoWeekId()}
              />
            </div>
            <div className="vstack" style={{gap:6}}>
              <label style={subtle}>Leader name</label>
              <input
                style={barWrap}
                value={form.leaderName}
                onChange={e=>setForm(f=>({...f, leaderName: e.target.value}))}
                placeholder="e.g., Alex G."
              />
            </div>
            <div className="vstack" style={{gap:6}}>
              <label style={subtle}>Leader UID (optional)</label>
              <input
                style={barWrap}
                value={form.leaderUid}
                onChange={e=>setForm(f=>({...f, leaderUid: e.target.value}))}
                placeholder="user uid"
              />
            </div>
            <div className="vstack" style={{gap:6}}>
              <label style={subtle}>Total value</label>
              <input
                style={barWrap}
                inputMode="decimal"
                value={form.value}
                onChange={e=>setForm(f=>({...f, value: e.target.value}))}
                placeholder="e.g., 320"
              />
            </div>
            <div className="vstack" style={{gap:6}}>
              <label style={subtle}>Metric</label>
              <input
                style={barWrap}
                value={form.metric}
                onChange={e=>setForm(f=>({...f, metric: e.target.value}))}
                placeholder="points, reps…"
              />
            </div>
            <div className="vstack" style={{gap:6}}>
              <label style={subtle}>Image URL (optional)</label>
              <input
                style={barWrap}
                value={form.imageUrl}
                onChange={e=>setForm(f=>({...f, imageUrl: e.target.value}))}
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="vstack" style={{gap:6}}>
            <label style={subtle}>Notes</label>
            <textarea
              rows={2}
              style={{...barWrap, height:80, padding:10, borderRadius:10}}
              value={form.notes}
              onChange={e=>setForm(f=>({...f, notes: e.target.value}))}
              placeholder="Shoutouts, tie-breakers, etc."
            />
          </div>
        </div>
      )}
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

/* ===========================
   Standards Section (progress + recent)
   =========================== */
function StandardsSection(){
  const { user } = useAuth()
  const [standards, setStandards] = useState([])
  const [myCheckoffs, setMyCheckoffs] = useState([])
  const [historyErr, setHistoryErr] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!user) return
    setErr(null)
    const unsub = onSnapshot(
      collection(db, "standards"),
      snap => setStandards(snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))),
      e => setErr(e)
    )
    return unsub
  }, [user])

  useEffect(() => {
    if (!user?.uid) return
    setErr(null)
    const unsub = onSnapshot(
      collection(db, "profiles", user.uid, "checkoffs"),
      snap => setMyCheckoffs(snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))),
      e => setErr(e)
    )
    return unsub
  }, [user?.uid])

  const tiers = ["committed", "developmental", "advanced", "elite"]
  const progress = useMemo(() => {
    const byTierTotal = Object.fromEntries(tiers.map(t => [t, 0]))
    const byTierChecked = Object.fromEntries(tiers.map(t => [t, 0]))
    const norm = (s) => (s || "").toString().trim().toLowerCase()

    for (const s of standards) {
      const t = norm(s.tier)
      if (byTierTotal[t] != null) byTierTotal[t]++
    }
    const checkedSet = new Set(myCheckoffs.filter(c => c.checked).map(c => c.id))
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
            <div style={subtle}>
              {progress.overall.done}/{progress.overall.total} — {progress.overall.pct}%
            </div>
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

        {!!user && err?.code === "permission-denied" && (
          <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
            Can’t read checkoff data. If you’re logged in, ask the owner to verify Firestore rules.
          </div>
        )}
      </div>

      {/* Recent Checkoffs */}
      <RecentCheckoffs userReady={!!user} setParentErr={setHistoryErr} />

      {historyErr && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(historyErr.message || historyErr)}
        </div>
      )}
    </div>
  )
}

/* ===========================
   Helper: Recent Checkoffs feed
   =========================== */
function RecentCheckoffs({ userReady, setParentErr }){
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!userReady) return
    setParentErr?.(null)
    const qy = query(collectionGroup(db, "history"), orderBy("createdAt", "desc"), limit(8))
    const unsub = onSnapshot(
      qy,
      snap => {
        const arr = snap.docs.map(d => {
          const p = d.ref.path.split("/")
          const uid = p[1]
          const standardId = p[3]
          return { id: d.id, uid, standardId, ...(d.data()||{}) }
        })
        setHistory(arr)
      },
      e => setParentErr?.(e)
    )
    return unsub
  }, [userReady, setParentErr])

  return (
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
  )
}
