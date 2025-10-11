// src/pages/Standards.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, writeBatch, getDocs
} from "firebase/firestore"

const TIERS = ["committed", "developmental", "advanced", "elite"]

// Default groups to seed (applies to all tiers when you click "Seed defaults")
const DEFAULTS = {
  strength: [
    "Deadlift",
    "Bench Press",
    "Back Squat",
    "Push Ups",
    "Pull Ups",
    "Overhead Press",
    "Farmers Carry",
  ],
  conditioning: [
    "1 Mile Run",
    "1.5 Mile Run",
    "5K Run",
    "500 m Row",
    "Stair Climb",
    "Burpees",
    "Wall Balls",
    "Jacobs Ladder",
  ],
  "circuit challenge": [
    "Circuit Challenge: 100 Push Ups, 100 Air Squats, 50 Burpees, 50 Sit Ups, 25 Pull Ups, 25 Lunges (for time)",
  ],
}

const input = { background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"6px 8px" }
const select = { ...input }
const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af" }
const td = { padding:"10px 12px" }

export default function Standards(){
  const { profile } = useAuth()
  const isOwner = (profile?.role === "owner")

  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set(TIERS)) // all open initially

  // new standard form
  const [newTitle, setNewTitle] = useState("")
  const [newTier, setNewTier] = useState("committed")
  const [newCategory, setNewCategory] = useState("strength")

  // live standards (normalize any old docs that might have "tier " field)
  useEffect(() => {
    const q = query(
      collection(db, "standards"),
      orderBy("tier"),
      orderBy("category"),
      orderBy("title")
    )
    const unsub = onSnapshot(q,
      snap => {
        const arr = snap.docs.map(d => {
          const data = d.data()
          const tier = data.tier ?? data["tier "] ?? "committed" // normalize
          return { id: d.id, ...data, tier }
        })
        setRows(arr)
      },
      e => setErr(e)
    )
    return unsub
  }, [])

  // group by tier
  const byTier = useMemo(() => {
    const map = Object.fromEntries(TIERS.map(t => [t, []]))
    rows.forEach(r => {
      const t = r.tier || "committed"
      if (!map[t]) map[t] = []
      map[t].push(r)
    })
    return map
  }, [rows])

  function toggleTier(tier){
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(tier) ? next.delete(tier) : next.add(tier)
      return next
    })
  }

  async function addStandard(e){
    e.preventDefault()
    if (!isOwner || !newTitle.trim()) return
    try{
      setBusy("add")
      await addDoc(collection(db, "standards"), {
        title: newTitle.trim(),
        tier: newTier,                 // correct key
        category: newCategory,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setNewTitle("")
    }catch(e){
      alert(`Add failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  async function saveRow(r){
    if (!isOwner) return
    const patch = {
      title: (r._title ?? r.title)?.trim() || r.title,
      category: (r._category ?? r.category) || "strength",
      tier: r._tier ?? r.tier,        // correct key
      updatedAt: serverTimestamp(),
    }
    try{
      setBusy(r.id)
      await updateDoc(doc(db, "standards", r.id), patch)
    }catch(e){
      alert(`Save failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  async function toggleActive(r, next){
    if (!isOwner) return
    try{
      setBusy(r.id)
      await setDoc(doc(db, "standards", r.id), { active: next, updatedAt: serverTimestamp() }, { merge:true })
    }catch(e){
      alert(`Update failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  async function removeRow(id){
    if (!isOwner) return
    if (!confirm("Delete this standard? (Existing user checkoffs for it will remain)")) return
    try{
      setBusy(id)
      await deleteDoc(doc(db, "standards", id))
    }catch(e){
      alert(`Delete failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  function setLocal(id, patch){
    setRows(curr => curr.map(r => r.id === id ? ({ ...r, ...patch }) : r))
  }

  // Seed defaults into ALL tiers (skips exact duplicates by (tier+title))
  async function seedDefaults(){
    if (!isOwner) return
    if (!confirm("Seed the default standards into ALL tiers?")) return
    try{
      setBusy("seed")

      // Build a dedupe set from current rows
      const existing = new Set(rows.map(r => `${(r.tier||"").toLowerCase()}|${(r.title||"").toLowerCase()}`))

      const batch = writeBatch(db)
      TIERS.forEach(tier => {
        Object.entries(DEFAULTS).forEach(([category, arr]) => {
          arr.forEach(title => {
            const key = `${tier}|${title.toLowerCase()}`
            if (existing.has(key)) return
            const ref = doc(collection(db, "standards"))
            batch.set(ref, {
              title,
              tier,                 // correct key
              category,
              active: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          })
        })
      })
      await batch.commit()
      alert("Defaults seeded.")
    }catch(e){
      alert(`Seed failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  return (
    <div className="container vstack">
      {/* Header */}
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <span className="badge">Standards</span>
            <span className="badge">Total: <b>{rows.length}</b></span>
          </div>
          {isOwner && (
            <div className="hstack" style={{gap:8}}>
              <button className="btn" onClick={()=>setExpanded(new Set())}>Collapse all</button>
              <button className="btn" onClick={()=>setExpanded(new Set(TIERS))}>Expand all</button>
              <button className="btn primary" disabled={busy==="seed"} onClick={seedDefaults}>
                {busy==="seed" ? "Seeding…" : "Seed defaults"}
              </button>
            </div>
          )}
        </div>
        {!isOwner && (
          <p style={{color:"#9ca3af", margin:0, fontSize:13}}>
            Only the <b>owner</b> can create or edit standards.
          </p>
        )}
      </div>

      {/* Add new */}
      {isOwner && (
        <div className="card vstack">
          <span className="badge">Add standard</span>
          <form onSubmit={addStandard} className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <input
              placeholder="Title (e.g., Deadlift)"
              value={newTitle}
              onChange={e=>setNewTitle(e.target.value)}
              style={{...input, minWidth:260}}
            />
            <select value={newCategory} onChange={e=>setNewCategory(e.target.value)} style={select}>
              {Object.keys(DEFAULTS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={newTier} onChange={e=>setNewTier(e.target.value)} style={select}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="btn primary" disabled={!newTitle.trim() || busy==="add"}>
              {busy==="add" ? "Saving…" : "Add"}
            </button>
          </form>
        </div>
      )}

      {/* Per-tier accordions */}
      {TIERS.map(tier => {
        const list = (byTier[tier] || []).sort((a,b) =>
          (a.category||"").localeCompare(b.category||"") ||
          (a.title||"").localeCompare(b.title||"")
        )
        const open = expanded.has(tier)
        const activeCount = list.filter(s => s.active !== false).length
        return (
          <div key={tier} className="card vstack">
            <button
              className="btn"
              onClick={()=>toggleTier(tier)}
              style={{alignSelf:"flex-start"}}
              aria-expanded={open}
              aria-controls={`tier-${tier}`}
            >
              {open ? "▼" : "►"} {tier} <span className="badge" style={{marginLeft:8}}>Active: {activeCount}</span>
            </button>

            {open && (
              <div id={`tier-${tier}`} style={{paddingTop:8}}>
                {list.length === 0 ? (
                  <p style={{color:"#9ca3af"}}>No standards yet in this tier.</p>
                ) : (
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{background:"#0f1a30"}}>
                          <th style={th}>Title</th>
                          <th style={th}>Category</th>
                          <th style={th}>Active</th>
                          {isOwner ? <th style={th}></th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(r => {
                          const editTitle = r._title ?? r.title
                          const editCat   = r._category ?? r.category
                          return (
                            <tr key={r.id} style={{borderTop:"1px solid #1f2937"}}>
                              <td style={td}>
                                {!isOwner ? r.title : (
                                  <input value={editTitle} onChange={e=>setLocal(r.id, { _title: e.target.value })} style={{...input, minWidth:280}} />
                                )}
                              </td>
                              <td style={td}>
                                {!isOwner ? (r.category || "—") : (
                                  <select value={editCat || "strength"} onChange={e=>setLocal(r.id, { _category: e.target.value })} style={select}>
                                    {Object.keys(DEFAULTS).map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                )}
                              </td>
                              <td style={td}>
                                {!isOwner ? (
                                  <span className="badge">{r.active === false ? "inactive" : "active"}</span>
                                ) : (
                                  <label className="hstack" style={{gap:8}}>
                                    <input
                                      type="checkbox"
                                      checked={r.active !== false}
                                      onChange={e=>toggleActive(r, e.target.checked)}
                                      disabled={busy === r.id}
                                    />
                                    <span>{r.active !== false ? "Active" : "Inactive"}</span>
                                  </label>
                                )}
                              </td>
                              {isOwner ? (
                                <td style={td} className="hstack" >
                                  <button className="btn primary" disabled={busy===r.id} onClick={()=>saveRow(r)}>Save</button>
                                  <button className="btn" disabled={busy===r.id} onClick={()=>removeRow(r.id)}>Delete</button>
                                </td>
                              ) : null}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}
    </div>
  )
}
