// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"

const subtle = { color:"#9ca3af", fontSize:12 }
const card = { background:"#0f1a30", border:"1px solid #1f2937", borderRadius:14, padding:14 }
const input = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:10, padding:"10px 12px"
}

function isoWeekIdOf(d){
  // returns "YYYY-Www" (e.g., 2025-W42)
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // Thursday in current week decides the year
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
  const { user, profile, loading } = useAuth()

  // super-owner support (optional; if you created settings/owners.uids)
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

  // Champion doc
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState(null)
  const [champ, setChamp] = useState(null)

  // Owner edit form
  const [form, setForm] = useState({
    weekId: previousIsoWeekId(),
    leaderName: "",
    leaderUid: "",
    value: "",
    metric: "points",
    notes: "",
    imageUrl: ""
  })

  // Load champion on mount / auth ready
  useEffect(() => {
    if (loading) return
    loadChampion()
  }, [loading, user?.uid])

  async function loadChampion(){
    setBusy(true); setErr(null)
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
        setForm(f => ({...f, weekId: previousIsoWeekId()}))
      }
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  async function saveChampion(){
    if (!ownerLike) return
    const valueNum = form.value === "" ? null : Number(form.value)
    if (form.value !== "" && !Number.isFinite(valueNum)) {
      alert("Value must be a number (or leave blank).")
      return
    }
    setBusy(true); setErr(null)
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
      alert("Champion updated.")
    } catch (e) {
      setErr(e); alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Auto-fill: compute leader from weekly logs
  async function autofillFromWeek(){
    if (!ownerLike) return
    const weekId = (form.weekId || "").trim()
    if (!weekId) { alert("Enter a week ID (e.g., 2025-W42)."); return }

    setBusy(true); setErr(null)
    try {
      const logsRef = collection(db, "weeklyChallenges", weekId, "logs")
      // orderBy not required; we just need all docs to sum by uid/name
      const snap = await getDocs(query(logsRef, orderBy("createdAt")))
      if (snap.empty) {
        alert(`No logs found for ${weekId}.`)
        setBusy(false)
        return
      }
      // Sum value by uid (fallback to name when uid missing)
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

      // Prefer uid-based totals
      for (const [uid, total] of totalsByUid.entries()) {
        if (total > best) {
          best = total
          leaderUid = uid
          leaderName = nameByUid.get(uid) || uid
        }
      }
      // If none had uid, fall back to name-based totals
      if (leaderUid === "") {
        for (const [name, total] of totalsByName.entries()) {
          if (total > best) {
            best = total
            leaderName = name
          }
        }
      }

      if (best === -Infinity) {
        alert(`No numeric values in logs for ${weekId}.`)
        setBusy(false)
        return
      }

      setForm(f => ({
        ...f,
        leaderUid,
        leaderName,
        value: String(best)
      }))
      alert(`Auto-filled: ${leaderName} with ${best} ${form.metric || "points"}. Now click Save.`)
    } catch (e) {
      setErr(e); alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container vstack" style={{gap:12}}>
      {/* Hero / Banner */}
      <div className="card vstack" style={{gap:8}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Home</span>
          <h2 style={{margin:0}}>Welcome {profile?.displayName || user?.email || "athlete"}</h2>
        </div>
        <div style={subtle}>Stay consistent. The results follow the work.</div>
      </div>

      {/* Weekly Champion */}
      <div className="card vstack" style={{gap:12}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
            <span className="badge">Weekly</span>
            <h3 style={{margin:0}}>Champion (previous week)</h3>
          </div>
          {ownerLike && (
            <div className="hstack" style={{gap:8}}>
              <button className="btn" onClick={autofillFromWeek} disabled={busy}>
                {busy ? "Calculating…" : "Auto-fill from week"}
              </button>
              <button className="btn" onClick={saveChampion} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Display */}
        {busy ? (
          <div>Loading…</div>
        ) : champ ? (
          <div className="hstack" style={{gap:16, alignItems:"center", flexWrap:"wrap"}}>
            {champ.imageUrl ? (
              <img
                src={champ.imageUrl}
                alt="Champion"
                style={{width:88, height:88, objectFit:"cover", borderRadius:12, border:"1px solid #1f2937"}}
              />
            ) : null}
            <div className="vstack" style={{gap:4}}>
              <div style={{fontSize:18, fontWeight:800}}>
                {champ.leaderName || "—"}
              </div>
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

        {/* Owner editor */}
        {ownerLike && (
          <div className="vstack" style={{gap:10, marginTop:6}}>
            <div className="grid" style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
              <div className="vstack" style={{gap:6}}>
                <label style={subtle}>Week ID (YYYY-Www)</label>
                <input
                  style={input}
                  value={form.weekId}
                  onChange={e=>setForm(f=>({...f, weekId: e.target.value}))}
                  placeholder={previousIsoWeekId()}
                />
              </div>
              <div className="vstack" style={{gap:6}}>
                <label style={subtle}>Leader name</label>
                <input
                  style={input}
                  value={form.leaderName}
                  onChange={e=>setForm(f=>({...f, leaderName: e.target.value}))}
                  placeholder="e.g., Alex G."
                />
              </div>
              <div className="vstack" style={{gap:6}}>
                <label style={subtle}>Leader UID (optional)</label>
                <input
                  style={input}
                  value={form.leaderUid}
                  onChange={e=>setForm(f=>({...f, leaderUid: e.target.value}))}
                  placeholder="user uid if known"
                />
              </div>
              <div className="vstack" style={{gap:6}}>
                <label style={subtle}>Total value</label>
                <input
                  style={input}
                  inputMode="decimal"
                  value={form.value}
                  onChange={e=>setForm(f=>({...f, value: e.target.value}))}
                  placeholder="e.g., 320"
                />
              </div>
              <div className="vstack" style={{gap:6}}>
                <label style={subtle}>Metric</label>
                <input
                  style={input}
                  value={form.metric}
                  onChange={e=>setForm(f=>({...f, metric: e.target.value}))}
                  placeholder="points, reps, miles…"
                />
              </div>
              <div className="vstack" style={{gap:6}}>
                <label style={subtle}>Image URL (optional)</label>
                <input
                  style={input}
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
                style={{...input, width:"100%", fontFamily:"inherit", lineHeight:1.4}}
                value={form.notes}
                onChange={e=>setForm(f=>({...f, notes: e.target.value}))}
                placeholder="Shoutouts, tie-breaker details, etc."
              />
            </div>

            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <button className="btn" onClick={saveChampion} disabled={busy}>
                {busy ? "Saving…" : "Save Champion"}
              </button>
              <button className="btn" onClick={autofillFromWeek} disabled={busy}>
                {busy ? "Calculating…" : "Auto-fill from week"}
              </button>
              <div style={subtle}>Tip: Auto-fill sums all <code>value</code> fields in <code>/weeklyChallenges/{'{weekId}'}/logs</code> and picks the top total.</div>
            </div>
          </div>
        )}
      </div>

      {/* You can keep/add your other Home cards below (totals, checkoffs, announcements, etc.) */}
    </div>
  )
}
