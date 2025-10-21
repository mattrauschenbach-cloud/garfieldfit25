// src/pages/Leaderboard.jsx
import { useEffect, useMemo, useState } from "react"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import {
  collection,
  deleteDoc,
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

const TIER_OPTIONS = [
  { value: "committed", label: "Committed" },
  { value: "developmental", label: "Developmental" },
  { value: "advanced", label: "Advanced" },
  { value: "elite", label: "Elite" },
]
const CAT_OPTIONS = [
  { value: "strength", label: "Strength" },
  { value: "conditioning", label: "Conditioning" },
  { value: "other", label: "Other" },
]

// simple slug from title
function slugify(s=""){
  return s.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60)
}

export default function Leaderboard(){
  const { user, loading, profile } = useAuth()

  // --- Fix: determine owner-like locally (role === 'owner' OR super-owner list) ---
  const [superOwner, setSuperOwner] = useState(false)
  const ownerLike = (profile?.role === "owner") || superOwner

  useEffect(() => {
    // Optional: reflect "super owner" backstop from settings/owners.uids
    async function checkSuper() {
      if (!user) { setSuperOwner(false); return }
      try {
        const snap = await getDoc(doc(db, "settings", "owners"))
        const uids = snap.exists() ? (snap.data()?.uids || []) : []
        setSuperOwner(Array.isArray(uids) && uids.includes(user.uid))
      } catch {
        setSuperOwner(false)
      }
    }
    checkSuper()
  }, [user?.uid])

  const canManage = !!ownerLike

  const [busy,   setBusy] = useState(true)
  const [err,    setErr]  = useState(null)
  const [rows,   setRows] = useState([])

  // filters / search
  const [qText, setQText] = useState("")
  const [tier,  setTier]  = useState("all")
  const [cat,   setCat]   = useState("all")

  // edit/add form state
  const [editingId, setEditingId] = useState(null) // null = add new
  const [form, setForm] = useState({
    title: "",
    tier: "committed",
    category: "strength",
    unit: "",
    value: "",
    holderName: "",
    notes: ""
  })

  useEffect(() => { load() }, [loading, user])

  async function load(){
    if (loading) return
    if (!user) { setBusy(false); setRows([]); return }
    setBusy(true); setErr(null)
    try {
      // load all standards ordered by title (no composite index required)
      const qy = query(collection(db, "standards"), orderBy("title"))
      const snap = await getDocs(qy)
      const out = []
      for (const d of snap.docs) {
        const sdata = d.data() || {}
        const recRef = doc(db, "standards", d.id, "record", "current")
        const recSnap = await getDoc(recRef)
        const rec = recSnap.exists() ? recSnap.data() : null
        out.push({
          id: d.id,
          title: (sdata.title || d.id).toString(),
          tier: (sdata.tier || "").toString(),
          category: (sdata.category || "").toString(),
          unit: rec?.unit || sdata.unit || "",
          value: rec?.value ?? null,
          holderName: rec?.holderName || "",
          notes: rec?.notes || "",
          updatedAt: rec?.updatedAt?.toDate?.()?.toLocaleString?.() || "",
        })
      }
      setRows(out)
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }

  function startAdd(){
    setEditingId(null)
    setForm({
      title: "",
      tier: "committed",
      category: "strength",
      unit: "",
      value: "",
      holderName: "",
      notes: ""
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  function startEdit(r){
    setEditingId(r.id)
    setForm({
      title: r.title || r.id,
      tier: r.tier || "committed",
      category: r.category || "strength",
      unit: r.unit || "",
      value: r.value ?? "",
      holderName: r.holderName || "",
      notes: r.notes || ""
    })
    const el = document.getElementById(r.id)
    if (el) el.scrollIntoView({ behavior:"smooth", block:"center" })
  }

  async function save(){
    if (!canManage) return
    const title = (form.title || "").trim()
    if (!title) { alert("Title is required."); return }

    const id = editingId || slugify(title)
    if (!id) { alert("Could not create an id from the title."); return }

    const valueNum = form.value === "" ? null : Number(form.value)
    if (form.value !== "" && !Number.isFinite(valueNum)) {
      alert("Record value must be a number (or leave blank).")
      return
    }

    setBusy(true)
    try {
      // ensure standard exists / update its basic fields
      await setDoc(doc(db, "standards", id), {
        title,
        tier: form.tier || "committed",
        category: form.category || "strength",
        unit: (form.unit || "").trim(),
        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid || null
      }, { merge: true })

      // set/update the record/current
      await setDoc(doc(db, "standards", id, "record", "current"), {
        value: valueNum,
        unit: (form.unit || "").trim(),
        holderName: (form.holderName || "").trim(),
        notes: (form.notes || "").trim(),
        updatedAt: serverTimestamp(),
        verifiedByUid: user?.uid || null,
        verifiedByName: profile?.displayName || user?.email || "owner"
      }, { merge: true })

      await load()
      setEditingId(id) // remain on that item
      alert("Saved.")
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id){
    if (!canManage || !id) return
    if (!confirm("Delete this standard and its record?")) return
    setBusy(true)
    try {
      await deleteDoc(doc(db, "standards", id))
      await load()
      if (editingId === id) startAdd()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase()
    return rows.filter(r => {
      if (tier !== "all" && (r.tier || "") !== tier) return false
      if (cat !== "all" && (r.category || "") !== cat) return false
      if (!t) return true
      return (
        (r.title || "").toLowerCase().includes(t) ||
        (r.category || "").toLowerCase().includes(t) ||
        (r.tier || "").toLowerCase().includes(t) ||
        (r.holderName || "").toLowerCase().includes(t)
      )
    })
  }, [rows, qText, tier, cat])

  return (
    <div className="container vstack" style={{gap:12}}>
      {/* Header */}
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Leaderboard</span>
          <h2 style={{margin:0}}>Records</h2>
        </div>
        <div style={subtle}>
          View top results. {canManage ? "As owner, add or edit records directly here." : ""}
        </div>
      </div>

      {/* Owner editor (Add/Edit) */}
      {canManage && (
        <div className="card vstack" style={{gap:10}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap"}}>
            <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
              <span className="badge">Editor</span>
              <h3 style={{margin:0}}>{editingId ? "Edit Record" : "Add Record"}</h3>
              {editingId && <span style={subtle}>ID: <code>{editingId}</code></span>}
            </div>
            <div className="hstack" style={{gap:8}}>
              <button className="btn" onClick={startAdd} disabled={busy}>New</button>
              <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>

          <div className="vstack" style={{gap:10}}>
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <div className="vstack" style={{gap:6, flex:2, minWidth:220}}>
                <label style={subtle}>Title</label>
                <input
                  style={{...input, width:"100%"}}
                  value={form.title}
                  onChange={e=>setForm(f=>({...f, title: e.target.value}))}
                  placeholder="Deadlift, Mile Run…"
                />
              </div>
              <div className="vstack" style={{gap:6, minWidth:180}}>
                <label style={subtle}>Tier</label>
                <select
                  style={input}
                  value={form.tier}
                  onChange={e=>setForm(f=>({...f, tier: e.target.value}))}
                >
                  {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="vstack" style={{gap:6, minWidth:180}}>
                <label style={subtle}>Category</label>
                <select
                  style={input}
                  value={form.category}
                  onChange={e=>setForm(f=>({...f, category: e.target.value}))}
                >
                  {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <div className="vstack" style={{gap:6, minWidth:140}}>
                <label style={subtle}>Value</label>
                <input
                  style={input}
                  inputMode="decimal"
                  value={form.value}
                  onChange={e=>setForm(f=>({...f, value: e.target.value}))}
                  placeholder="e.g., 405"
                />
              </div>
              <div className="vstack" style={{gap:6, minWidth:140}}>
                <label style={subtle}>Unit</label>
                <input
                  style={input}
                  value={form.unit}
                  onChange={e=>setForm(f=>({...f, unit: e.target.value}))}
                  placeholder="lb, reps, sec…"
                />
              </div>
              <div className="vstack" style={{gap:6, flex:1, minWidth:200}}>
                <label style={subtle}>Holder</label>
                <input
                  style={input}
                  value={form.holderName}
                  onChange={e=>setForm(f=>({...f, holderName: e.target.value}))}
                  placeholder="Name of record holder"
                />
              </div>
            </div>

            <div className="vstack" style={{gap:6}}>
              <label style={subtle}>Notes (optional)</label>
              <textarea
                rows={2}
                style={{...input, width:"100%", fontFamily:"inherit", lineHeight:1.4}}
                value={form.notes}
                onChange={e=>setForm(f=>({...f, notes: e.target.value}))}
                placeholder="Judging details, date, conditions…"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
          <input
            style={{...input, minWidth:220, flex:1}}
            placeholder="Search title, holder…"
            value={qText}
            onChange={e=>setQText(e.target.value)}
          />
          <select style={input} value={tier} onChange={e=>setTier(e.target.value)}>
            <option value="all">All tiers</option>
            {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select style={input} value={cat} onChange={e=>setCat(e.target.value)}>
            <option value="all">All categories</option>
            {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn" onClick={load} disabled={busy}>{busy ? "Loading…" : "Refresh"}</button>
        </div>
      </div>

      {/* List */}
      {busy ? (
        <div className="card">Loading…</div>
      ) : err ? (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{color:"#9ca3af"}}>No records yet.</div>
      ) : (
        <div className="grid" style={{
          display:"grid",
          gap:12,
          gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))"
        }}>
          {filtered.map(r => (
            <div key={r.id} id={r.id} style={card}>
              <div className="vstack" style={{gap:8}}>
                <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline", gap:8, flexWrap:"wrap"}}>
                  <div style={{fontWeight:800}}>{r.title}</div>
                  <div className="hstack" style={{gap:6, flexWrap:"wrap"}}>
                    {r.tier && <span className="badge">{r.tier}</span>}
                    {r.category && <span className="badge">{r.category}</span>}
                  </div>
                </div>

                <div className="vstack" style={{gap:4}}>
                  <div style={{fontSize:28, fontWeight:900}}>
                    {r.value == null ? "—" : r.value}
                    {r.unit ? <span style={{fontSize:14, color:"#9ca3af"}}> {r.unit}</span> : null}
                  </div>
                  <div style={subtle}>
                    Holder: <b style={{color:"#e5e7eb"}}>{r.holderName || "—"}</b>
                    {r.updatedAt ? <> · Updated {r.updatedAt}</> : null}
                  </div>
                  {r.notes ? <div style={{color:"#cbd5e1"}}>{r.notes}</div> : null}
                </div>

                {canManage && (
                  <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
                    <button className="btn" onClick={()=>startEdit(r)}>Edit</button>
                    <button className="btn" onClick={()=>remove(r.id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
