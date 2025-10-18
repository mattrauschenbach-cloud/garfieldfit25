// src/pages/Weekly.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore"

const subtle = { color:"#9ca3af", fontSize:12 }
const input = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:10, padding:"10px 12px"
}
const table = { width:"100%", borderCollapse:"collapse" }
const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af",
  borderBottom:"1px solid #1f2937", background:"#0f1a30" }
const td = { padding:"10px 12px", borderBottom:"1px solid #1f2937" }

export default function Weekly(){
  const { user, profile, isOwner, isAdmin } = useAuth()
  const canManageWeek = isOwner || isAdmin

  const [weeks, setWeeks] = useState([])
  const [current, setCurrent] = useState(null)
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // Form for adding a log
  const [val, setVal] = useState("")
  const [note, setNote] = useState("")

  // Manage form (create/edit week)
  const [wTitle, setWTitle] = useState("")
  const [wUnit, setWUnit] = useState("")

  // Fetch recent weeks (newest first), then pick current and archived.
  useEffect(() => {
    setErr(null)
    const qy = query(collection(db, "weeklyChallenges"), orderBy("startDate", "desc"), limit(25))
    const unsub = onSnapshot(qy, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
      setWeeks(arr)
    }, e => setErr(e))
    return unsub
  }, [])

  // Determine current week and subscribe to its logs
  useEffect(() => {
    if (!weeks.length) { setCurrent(null); setLogs([]); return }
    const active = weeks.find(w => w.active !== false) || weeks[0]
    setCurrent(active)

    // seed edit fields with current values
    if (active) {
      setWTitle(active.title || "")
      setWUnit(active.unit || "")
    }

    if (!active?.id) { setLogs([]); return }
    const ref = collection(db, "weeklyChallenges", active.id, "logs")
    const unsub = onSnapshot(ref, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) })))
    }, e => setErr(e))
    return unsub
  }, [weeks])

  // Aggregate leaderboard + totals (client-side)
  const agg = useMemo(() => {
    const byUser = new Map()
    let teamTotal = 0
    for (const l of logs) {
      const uid = l.uid || "unknown"
      const name = l.displayName || uid
      const v = Number(l.value) || 0
      teamTotal += v
      const cur = byUser.get(uid) || { uid, name, total: 0 }
      cur.total += v
      byUser.set(uid, cur)
    }
    const leaderboard = [...byUser.values()].sort((a,b)=> b.total - a.total)
    const leader = leaderboard[0] || null
    return { teamTotal, leader, leaderboard }
  }, [logs])

  async function addLog(){
    if (!user?.uid || !current?.id) return
    const v = Number(val)
    if (!Number.isFinite(v) || v <= 0) { alert("Enter a positive number"); return }
    setBusy(true)
    try {
      await addDoc(collection(db, "weeklyChallenges", current.id, "logs"), {
        uid: user.uid,
        displayName: profile?.displayName || user.email || "Member",
        value: v,
        note: (note || "").trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setVal("")
      setNote("")
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Owner/Admin: Archive current week — compute totals and write to doc
  async function archiveWeek(){
    if (!canManageWeek || !current?.id) return
    if (!confirm("Archive this week? This will mark it inactive and store team total & leader.")) return
    setBusy(true)
    try {
      // Read all logs once to compute final stats (don’t rely on state)
      const lsnap = await getDocs(collection(db, "weeklyChallenges", current.id, "logs"))
      let team = 0
      const byUser = new Map()
      lsnap.forEach(d => {
        const data = d.data() || {}
        const uid = data.uid || "unknown"
        const name = data.displayName || uid
        const v = Number(data.value) || 0
        team += v
        const cur = byUser.get(uid) || { uid, name, total: 0 }
        cur.total += v
        byUser.set(uid, cur)
      })
      const leaderboard = [...byUser.values()].sort((a,b)=> b.total - a.total)
      const leader = leaderboard[0] || null

      await updateDoc(doc(db, "weeklyChallenges", current.id), {
        active: false,
        teamTotal: team,
        leaderUid: leader?.uid || null,
        leaderName: leader?.name || null,
        leaderTotal: leader?.total || 0,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      alert("Week archived.")
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Owner/Admin: Create a brand-new active week
  async function createWeek(){
    if (!canManageWeek) return
    const title = (wTitle || "").trim()
    const unit = (wUnit || "").trim()
    if (!title) { alert("Please enter a week title first."); return }
    setBusy(true)
    try {
      // Deactivate any current active week (best effort — optional)
      const currId = current?.id
      if (currId && current?.active !== false) {
        await updateDoc(doc(db, "weeklyChallenges", currId), { active: false, updatedAt: serverTimestamp() })
      }
      // Create new current week
      await setDoc(doc(collection(db, "weeklyChallenges")), {
        title,
        unit,
        startDate: new Date().toISOString(),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setWTitle("")
      setWUnit("")
      alert("New week created.")
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Owner/Admin: Save edits to the current week (title/unit)
  async function saveWeekDetails(){
    if (!canManageWeek || !current?.id) return
    const title = (wTitle || "").trim()
    const unit = (wUnit || "").trim()
    if (!title) { alert("Title is required."); return }
    setBusy(true)
    try {
      await updateDoc(doc(db, "weeklyChallenges", current.id), {
        title,
        unit,
        updatedAt: serverTimestamp(),
      })
      alert("Week details saved.")
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Owner/Admin: Re-open an archived week (optional)
  async function reopenWeek(){
    if (!canManageWeek || !current?.id) return
    if (!confirm("Re-open this archived week as active?")) return
    setBusy(true)
    try {
      await updateDoc(doc(db, "weeklyChallenges", current.id), {
        active: true,
        updatedAt: serverTimestamp(),
      })
      alert("Week re-opened.")
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const archived = useMemo(
    () => weeks.filter(w => w.active === false),
    [weeks]
  )

  return (
    <div className="container vstack" style={{gap:12}}>
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Weekly</span>
          <h2 style={{margin:0}}>Weekly Challenge</h2>
        </div>
        <div style={subtle}>
          Create and edit the current weekly challenge; members log efforts. Archiving stores team total and leader.
        </div>
      </div>

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}

      {/* Manage Week (Owner/Admin) */}
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
            <span className="badge">Manage</span>
            <h3 style={{margin:0}}>Current Week Settings</h3>
          </div>
          {canManageWeek && current && (
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              {current.active === false ? (
                <button className="btn" onClick={reopenWeek} disabled={busy}>Re-open</button>
              ) : (
                <button className="btn" onClick={archiveWeek} disabled={busy}>
                  {busy ? "Working…" : "Archive week"}
                </button>
              )}
            </div>
          )}
        </div>

        {canManageWeek ? (
          <>
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <input
                style={{...input, flex:1, minWidth:220}}
                value={wTitle}
                onChange={e=>setWTitle(e.target.value)}
                placeholder="Week title (e.g., Week of Oct 20)"
              />
              <input
                style={{...input, minWidth:160}}
                value={wUnit}
                onChange={e=>setWUnit(e.target.value)}
                placeholder="Unit (miles, pushups, minutes...)"
              />
            </div>
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              {current ? (
                <>
                  <button className="btn" onClick={saveWeekDetails} disabled={busy}>
                    Save week details
                  </button>
                  <button className="btn" onClick={createWeek} disabled={busy}>
                    New week
                  </button>
                </>
              ) : (
                <button className="btn" onClick={createWeek} disabled={busy}>
                  Create current week
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{color:"#9ca3af"}}>Only owner/admin can manage week settings.</div>
        )}
      </div>

      {/* Current Week view */}
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10}}>
          <div className="vstack" style={{gap:2}}>
            <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
              <span className="badge">Current</span>
              <h3 style={{margin:0}}>{current?.title || "No current week"}</h3>
              {current?.unit && <span style={subtle}>Unit: {current.unit}</span>}
              {current && current.active === false && <span className="badge">archived</span>}
            </div>
          </div>
        </div>

        {!current ? (
          <div style={{color:"#9ca3af"}}>No weeks yet. {canManageWeek && "Create one to get started."}</div>
        ) : current.active === false ? (
          <div style={{color:"#9ca3af"}}>
            This week is archived. Team total: <b>{current.teamTotal ?? 0}</b>{current.unit ? ` ${current.unit}` : ""}.
            {current.leaderName ? <> Leader: <b>{current.leaderName}</b> ({current.leaderTotal ?? 0}{current.unit ? ` ${current.unit}` : ""}).</> : null}
          </div>
        ) : (
          <>
            {/* Big stats */}
            <div className="hstack" style={{gap:12, flexWrap:"wrap"}}>
              <Stat label="Team total">
                <b>{agg.teamTotal}</b>{current.unit ? ` ${current.unit}` : ""}
              </Stat>
              <Stat label="Leader">
                {agg.leader
                  ? <><b>{agg.leader.name}</b> — <b>{agg.leader.total}</b>{current.unit ? ` ${current.unit}` : ""}</>
                  : "—"}
              </Stat>
            </div>

            {/* Log form */}
            <div className="vstack" style={{gap:8}}>
              <div style={subtle}>Add to your total</div>
              <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
                <input
                  style={input}
                  type="number"
                  min="0"
                  step="any"
                  value={val}
                  onChange={e=>setVal(e.target.value)}
                  placeholder={`Amount (${current.unit || "units"})`}
                />
                <input
                  style={{...input, minWidth:240, flex:1}}
                  value={note}
                  onChange={e=>setNote(e.target.value)}
                  placeholder="Note (optional)"
                />
                <button className="btn" onClick={addLog} disabled={busy}>Add log</button>
              </div>
            </div>

            {/* Leaderboard (live from logs) */}
            <div className="vstack" style={{gap:8}}>
              <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
                <span className="badge">Live</span>
                <h3 style={{margin:0}}>Leaderboard</h3>
              </div>
              {agg.leaderboard.length === 0 ? (
                <div style={{color:"#9ca3af"}}>No logs yet.</div>
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
                      {agg.leaderboard.map((r, i) => (
                        <tr key={r.uid}>
                          <td style={td}><b>{i+1}</b></td>
                          <td style={td}>{r.name}</td>
                          <td style={td}><b>{r.total}</b>{current.unit ? ` ${current.unit}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Archived Weeks */}
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
          <span className="badge">Archive</span>
          <h3 style={{margin:0}}>Archived Weeks</h3>
        </div>

        {archived.length === 0 ? (
          <div style={{color:"#9ca3af"}}>No archived weeks yet.</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Week</th>
                  <th style={th}>Team total</th>
                  <th style={th}>Leader</th>
                  <th style={th}>Archived</th>
                </tr>
              </thead>
              <tbody>
                {archived.map(w => (
                  <tr key={w.id}>
                    <td style={td}><b>{w.title || w.id}</b></td>
                    <td style={td}>
                      <b>{w.teamTotal ?? 0}</b>{w.unit ? ` ${w.unit}` : ""}
                    </td>
                    <td style={td}>
                      {w.leaderName ? (<><b>{w.leaderName}</b> ({w.leaderTotal ?? 0}{w.unit ? ` ${w.unit}` : ""})</>) : "—"}
                    </td>
                    <td style={td}>{w.archivedAt?.toDate?.()?.toLocaleString?.() || "—"}</td>
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

/* Small stat card */
function Stat({ label, children }){
  return (
    <div className="vstack" style={{
      minWidth: 160, padding:"14px 16px", border:"1px solid #1f2937",
      background:"#0f1a30", borderRadius:14
    }}>
      <div style={{ color:"#9ca3af", fontSize:12 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, lineHeight:1, marginTop:4, color:"#e5e7eb" }}>
        {children}
      </div>
    </div>
  )
}
