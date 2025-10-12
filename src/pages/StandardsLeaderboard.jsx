// src/pages/StandardsLeaderboard.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import {
  collection, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc
} from "firebase/firestore"

const TIERS = ["committed", "developmental", "advanced", "elite"]

const select = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:8, padding:"8px 10px", minWidth:180
}
const input = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:8, padding:"8px 10px", minWidth:160
}
const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af", borderBottom:"1px solid #1f2937" }
const td = { padding:"10px 12px", borderBottom:"1px solid #1f2937" }

export default function StandardsLeaderboard(){
  const { user, profile } = useAuth()
  const role = profile?.role || "member"
  const isOwner = role === "owner"

  const [err, setErr] = useState(null)

  // Standards + fallback sort if multi-order requires index
  const [standards, setStandards] = useState([])
  const [usingFallback, setUsingFallback] = useState(false)
  const standardsUnsub = useRef(null)

  // Records map: { standardId: { holderUid, holderName, value, unit, notes, updatedAt, verifiedByName } }
  const [records, setRecords] = useState({})

  // Per-standard record listeners
  const recordUnsubs = useRef({}) // { stdId: () => void }

  // Members list for owner picker
  const [members, setMembers] = useState([])

  // Owner input state
  const [selStdId, setSelStdId] = useState("")
  const [selUid, setSelUid] = useState("")
  const [value, setValue] = useState("")
  const [unit, setUnit] = useState("")
  const [note, setNote] = useState("")

  // ---- Load members (for owner picker) ----
  useEffect(() => {
    if (!isOwner) return
    const unsub = onSnapshot(
      query(collection(db, "profiles"), orderBy("displayName")),
      snap => {
        const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
        setMembers(arr)
        if (!selUid && arr.length) setSelUid(arr[0].id)
      },
      e => setErr(e)
    )
    return unsub
  }, [isOwner]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Standards subscription (with index fallback) ----
  useEffect(() => {
    function normalize(docSnap) {
      const data = docSnap.data() || {}
      const tier = data.tier ?? data["tier "] ?? "committed"
      const category = data.category ?? data["category "] ?? ""
      const unit = data.unit || "" // optional hint
      return { id: docSnap.id, ...data, tier, category, unit }
    }

    function subPrimary() {
      const qy = query(
        collection(db, "standards"),
        orderBy("tier"),
        orderBy("category"),
        orderBy("title")
      )
      return onSnapshot(
        qy,
        snap => {
          const arr = snap.docs.map(normalize)
          setStandards(arr)
          setUsingFallback(false)
          setErr(null)
        },
        e => {
          const msg = (e?.message || "").toLowerCase()
          if (msg.includes("requires an index")) {
            if (standardsUnsub.current) standardsUnsub.current()
            standardsUnsub.current = subFallback()
            setUsingFallback(true)
            return
          }
          setErr(e)
        }
      )
    }

    function subFallback() {
      const qy = query(collection(db, "standards"), orderBy("tier"))
      return onSnapshot(
        qy,
        snap => {
          const arr = snap.docs.map(normalize).sort((a,b) =>
            (a.tier||"").localeCompare(b.tier||"") ||
            (a.category||"").localeCompare(b.category||"") ||
            (a.title||"").localeCompare(b.title||"")
          )
          setStandards(arr)
          setErr(null)
        },
        e => setErr(e)
      )
    }

    standardsUnsub.current = subPrimary()
    return () => { if (standardsUnsub.current) standardsUnsub.current() }
  }, [])

  // ---- When standards list changes, (re)subscribe to each /record/current doc ----
  useEffect(() => {
    // Unsub removed standards
    const currentIds = new Set(standards.map(s => s.id))
    Object.entries(recordUnsubs.current).forEach(([stdId, unsub]) => {
      if (!currentIds.has(stdId)) { unsub(); delete recordUnsubs.current[stdId] }
    })

    // Sub new standards
    standards.forEach(s => {
      if (recordUnsubs.current[s.id]) return
      const ref = doc(db, "standards", s.id, "record", "current")
      const unsub = onSnapshot(ref, snap => {
        setRecords(prev => ({
          ...prev,
          [s.id]: snap.exists() ? { id: snap.id, ...(snap.data()||{}) } : undefined
        }))
      }, e => setErr(e))
      recordUnsubs.current[s.id] = unsub
    })

    // init dropdown default
    if (!selStdId && standards.length) setSelStdId(standards[0].id)

    return () => {} // individual unsubs handled above
  }, [standards, selStdId])

  // Derived: standards grouped by tier
  const grouped = useMemo(() => {
    const g = {}
    TIERS.forEach(t => g[t] = [])
    standards.forEach(s => {
      const t = s.tier || "committed"
      if (!g[t]) g[t] = []
      g[t].push(s)
    })
    return g
  }, [standards])

  const selectedStd = useMemo(
    () => standards.find(s => s.id === selStdId),
    [standards, selStdId]
  )

  useEffect(() => {
    if (!selectedStd) return
    if (!unit && selectedStd.unit) setUnit(selectedStd.unit)
  }, [selectedStd, unit])

  async function saveRecord(){
    if (!isOwner) { alert("Only the owner can set records."); return }
    if (!selStdId || !selUid) { alert("Select a standard and a member."); return }
    const num = Number(value)
    if (!Number.isFinite(num)) { alert("Value must be a number."); return }

    try {
      const profSnap = await getDoc(doc(db, "profiles", selUid))
      const displayName = profSnap.exists() ? (profSnap.data().displayName || selUid) : selUid

      await setDoc(
        doc(db, "standards", selStdId, "record", "current"),
        {
          holderUid: selUid,
          holderName: displayName,
          value: num,
          unit: unit || selectedStd?.unit || "",
          notes: (note || "").trim(),
          updatedAt: serverTimestamp(),
          verifiedByUid: user?.uid || null,
          verifiedByName: profile?.displayName || user?.email || "owner"
        },
        { merge: true }
      )
      setNote("")
      alert("Record saved.")
    } catch (e) {
      alert(`Failed to save: ${e.code || e.message}`)
    }
  }

  return (
    <div className="container vstack">
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{justifyContent:"space-between", gap:8, flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <span className="badge">Standards Leaderboard</span>
            {usingFallback && <span className="badge">fallback sort</span>}
          </div>
        </div>

        {isOwner ? (
          <div className="vstack" style={{gap:10}}>
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <select value={selStdId} onChange={e=>setSelStdId(e.target.value)} style={select} title="Standard">
                {standards.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.tier}{s.category ? ` / ${s.category}` : ""}
                  </option>
                ))}
              </select>

              <select value={selUid} onChange={e=>setSelUid(e.target.value)} style={select} title="Member">
                <option value="" disabled>Select member…</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName || m.id}</option>)
                )}
              </select>

              <input
                type="number" placeholder="Value"
                value={value} onChange={e=>setValue(e.target.value)}
                style={input}
              />
              <input
                type="text" placeholder="Unit (e.g., lbs, seconds, reps)"
                value={unit} onChange={e=>setUnit(e.target.value)}
                style={input}
              />
            </div>

            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <input
                type="text" placeholder="Optional note (e.g., date, witness, rules)"
                value={note} onChange={e=>setNote(e.target.value)}
                style={{...input, minWidth:320}}
              />
              <button className="btn primary" onClick={saveRecord}>Save record</button>
            </div>
          </div>
        ) : (
          <p style={{color:"#9ca3af", margin:0}}>Viewing leaderboard. (Owner can set records above.)</p>
        )}
      </div>

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}

      {/* Tables by tier */}
      {TIERS.map(tier => {
        const list = (grouped[tier] || []).filter(s => s.active !== false)
        if (list.length === 0) return null
        return (
          <div key={tier} className="card vstack">
            <div className="hstack" style={{justifyContent:"space-between"}}>
              <h3 style={{margin:"0 0 8px 0"}}>{tier.toUpperCase()}</h3>
              <span className="badge">{list.length} standards</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#0f1a30"}}>
                    <th style={th}>Standard</th>
                    <th style={th}>Category</th>
                    <th style={th}>Record holder</th>
                    <th style={th}>Record</th>
                    <th style={th}>Updated</th>
                    <th style={th}>Verified by</th>
                    <th style={th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(s => {
                    const r = records[s.id]
                    return (
                      <tr key={s.id}>
                        <td style={td}><b>{s.title}</b></td>
                        <td style={td}>{s.category || "—"}</td>
                        <td style={td}>{r?.holderName || "—"}</td>
                        <td style={td}>
                          {r?.value != null ? `${r.value} ${r.unit || s.unit || ""}` : "—"}
                        </td>
                        <td style={td}>
                          {r?.updatedAt?.toDate ? r.updatedAt.toDate().toLocaleString() : "—"}
                        </td>
                        <td style={td}>{r?.verifiedByName || "—"}</td>
                        <td style={td}>{r?.notes || "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
