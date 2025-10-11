// src/pages/Standards.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc
} from "firebase/firestore"

const TIERS = ["committed", "developmental", "advanced", "elite"]

export default function Standards(){
  const { profile } = useAuth()
  const isMentor = ["mentor","admin","owner"].includes(profile?.role || "member")

  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)

  // new standard form
  const [title, setTitle]   = useState("")
  const [tier, setTier]     = useState("committed")
  const [category, setCategory] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "standards"), orderBy("tier"), orderBy("title"))
    const unsub = onSnapshot(q,
      snap => setRows(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => setErr(e)
    )
    return unsub
  }, [])

  const completedCount = useMemo(() => rows.filter(r => r.active !== false).length, [rows])

  async function addStandard(e){
    e.preventDefault()
    if (!isMentor || !title.trim()) return
    try {
      setBusy(true)
      await addDoc(collection(db, "standards"), {
        title: title.trim(),
        tier,
        category: category.trim() || null,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setTitle(""); setCategory(""); setTier("committed")
    } catch (e) {
      alert(`Add failed: ${e.code || e.message}`)
    } finally { setBusy(false) }
  }

  async function saveRow(r){
    if (!isMentor) return
    try{
      setBusy(r.id)
      await updateDoc(doc(db, "standards", r.id), {
        title: r._editTitle ?? r.title,
        tier: r._editTier ?? r.tier,
        category: (r._editCategory ?? r.category) || null,
        updatedAt: serverTimestamp(),
      })
    }catch(e){ alert(`Save failed: ${e.code || e.message}`) }
    finally{ setBusy(null) }
  }

  async function toggleActive(id, active){
    if (!isMentor) return
    try{
      setBusy(id)
      await setDoc(doc(db, "standards", id), { active }, { merge: true })
    }catch(e){ alert(`Update failed: ${e.code || e.message}`) }
    finally{ setBusy(null) }
  }

  async function removeRow(id){
    if (!isMentor) return
    if (!confirm("Delete this standard? (Users’ checkoffs for it will remain orphaned)")) return
    try{
      setBusy(id)
      await deleteDoc(doc(db, "standards", id))
    }catch(e){ alert(`Delete failed: ${e.code || e.message}`) }
    finally{ setBusy(null) }
  }

  // local edit helpers
  function setLocal(id, patch){
    setRows(curr => curr.map(r => r.id === id ? ({ ...r, ...patch }) : r))
  }

  return (
    <div className="container vstack">
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", gap:12}}>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <span className="badge">Standards</span>
            <span className="badge">Active: <b>{completedCount}</b></span>
          </div>
        </div>
        {!isMentor && (
          <p style={{color:"#9ca3af", margin:0, fontSize:13}}>
            Only mentors/admins/owners can add or edit standards.
          </p>
        )}
      </div>

      {isMentor && (
        <div className="card vstack">
          <span className="badge">Add standard</span>
          <form onSubmit={addStandard} className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <input
              placeholder="Title (required)"
              value={title}
              onChange={e=>setTitle(e.target.value)}
              style={input}
            />
            <select value={tier} onChange={e=>setTier(e.target.value)} style={select}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              placeholder="Category (optional)"
              value={category}
              onChange={e=>setCategory(e.target.value)}
              style={input}
            />
            <button className="btn primary" disabled={!title.trim() || !!busy}>
              {busy ? "Saving…" : "Add"}
            </button>
          </form>
        </div>
      )}

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}

      <div className="card" style={{padding:0, overflowX:"auto"}}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#0f1a30"}}>
              <th style={th}>Title</th>
              <th style={th}>Tier</th>
              <th style={th}>Category</th>
              <th style={th}>Active</th>
              {isMentor ? <th style={th}></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const edit = {
                title:   r._editTitle   ?? r.title,
                tier:    r._editTier    ?? r.tier,
                category:r._editCategory?? r.category || ""
              }
              return (
                <tr key={r.id} style={{borderTop:"1px solid #1f2937"}}>
                  <td style={td}>
                    {!isMentor ? r.title : (
                      <input value={edit.title} onChange={e=>setLocal(r.id, {_editTitle:e.target.value})} style={input} />
                    )}
                  </td>
                  <td style={td}>
                    {!isMentor ? <span className="badge">{r.tier}</span> : (
                      <select value={edit.tier} onChange={e=>setLocal(r.id, {_editTier:e.target.value})} style={select}>
                        {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={td}>
                    {!isMentor ? (r.category || "—") : (
                      <input value={edit.category} onChange={e=>setLocal(r.id, {_editCategory:e.target.value})} style={input} />
                    )}
                  </td>
                  <td style={td}>
                    {!isMentor ? (
                      <span className="badge">{r.active === false ? "inactive" : "active"}</span>
                    ) : (
                      <label className="hstack" style={{gap:8}}>
                        <input
                          type="checkbox"
                          checked={r.active !== false}
                          onChange={e=>toggleActive(r.id, e.target.checked)}
                          disabled={busy === r.id}
                        />
                        <span>{r.active !== false ? "Active" : "Inactive"}</span>
                      </label>
                    )}
                  </td>
                  {isMentor ? (
                    <td style={td} className="hstack" >
                      <button className="btn primary" disabled={busy===r.id} onClick={()=>saveRow(r)}>Save</button>
                      <button className="btn" disabled={busy===r.id} onClick={()=>removeRow(r.id)}>Delete</button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td style={{...td, color:"#9ca3af"}} colSpan={isMentor?5:4}>No standards yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af" }
const td = { padding:"12px" }
const input = { background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"6px 8px", minWidth:180 }
const select = { ...input }
