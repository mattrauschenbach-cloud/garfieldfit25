// src/pages/Leaderboard.jsx
import { useEffect, useMemo, useState } from "react"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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
const btnGhost = { ...input, background:"transparent", cursor:"pointer" }

export default function Leaderboard(){
  const { user, loading, isOwner, isAdmin, profile } = useAuth()
  const canManage = isOwner || isAdmin

  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState(null)
  const [rows, setRows] = useState([])
  const [standardIds, setStandardIds] = useState([])

  // owner editor for the curated list
  const [editStr, setEditStr] = useState("")
  const idsPreview = useMemo(
    () => editStr.split(",").map(s => s.trim()).filter(Boolean),
    [editStr]
  )

  // Profiles (for quick holder pick) — loaded on demand
  const [profiles, setProfiles] = useState([])
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  async function ensureProfiles(){
    if (profilesLoaded || !canManage) return
    try {
      const qy = query(collection(db, "profiles"), orderBy("displayName"), limit(100))
      const snap = await getDocs(qy)
      setProfiles(snap.docs.map(d => ({
        uid: d.id,
        displayName: (d.data()?.displayName || d.id).toString(),
        tier: (d.data()?.tier || "").toString()
      })))
      setProfilesLoaded(true)
    } catch {}
  }

  // Load /settings/records and fetch only those standards
  async function loadRecordsSet(){
    if (loading) return
    if (!user) { setErr({ code:"permission-denied", message:"Sign in required" }); setBusy(false); return }

    setBusy(true); setErr(null)
    try {
      const setRef = doc(db, "settings", "records")
      const setSnap = await getDoc(setRef)
      let ids = []
      if (setSnap.exists()) {
        const data = setSnap.data() || {}
        ids = Array.isArray(data.standardIds) ? data.standardIds.map(x => String(x)) : []
      }

      setStandardIds(ids)
      setEditStr(ids.join(", "))

      const out = []
      for (const id of ids) {
        const stdRef = doc(db, "standards", id)
        const stdSnap = await getDoc(stdRef)
        if (!stdSnap.exists()) {
          out.push({ id, title: id, missing: true })
          continue
        }
        const sd = stdSnap.data() || {}

        const recRef = doc(db, "standards", id, "record", "current")
        const recSnap = await getDoc(recRef)
        const rec = recSnap.exists() ? recSnap.data() : null

        out.push({
          id,
          title: (sd.title || id).toString(),
          tier: (sd.tier || "").toString(),
          category: (sd.category || "").toString(),
          unit: rec?.unit || sd.unit || "",
          value: rec?.value ?? null,
          holderName: rec?.holderName || "",
          notes: rec?.notes || "",
          updatedAt: rec?.updatedAt?.toDate?.()?.toLocaleString?.() || "",
          missing: false,
        })
      }

      setRows(out)
    } catch (e) {
      setErr(e)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => { loadRecordsSet() }, [loading, user])

  async function saveRecordsSet(){
    if (!canManage) return
    const ids = idsPreview
    setBusy(true)
    try {
      await setDoc(doc(db, "settings", "records"), {
        standardIds: ids,
        updatedAt: serverTimestamp()
      }, { merge: true })
      setStandardIds(ids)
      await loadRecordsSet()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Per-card edit state
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ value: "", unit: "", holderName: "", notes: "" })

  function beginEdit(r){
    setEditId(r.id)
    setForm({
      value: r.value ?? "",
      unit: r.unit || "",
      holderName: r.holderName || "",
      notes: r.notes || ""
    })
    ensureProfiles()
  }
  function cancelEdit(){ setEditId(null) }

  async function saveRecord(standardId){
    if (!canManage || !standardId) return
    const valueNum = form.value === "" ? null : Number(form.value)
    if (form.value !== "" && !Number.isFinite(valueNum)) {
      alert("Record value must be a number (or leave blank).")
      return
    }
    setBusy(true)
    try {
      await setDoc(
        doc(db, "standards", standardId, "record", "current"),
        {
          value: valueNum,
          unit: (form.unit || "").trim(),
          holderName: (form.holderName || "").trim(),
          notes: (form.notes || "").trim(),
          updatedAt: serverTimestamp(),
          verifiedByUid: user?.uid || null,
          verifiedByName: profile?.displayName || user?.email || "admin"
        },
        { merge: true }
      )
      setEditId(null)
      await loadRecordsSet()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function addId(id){
    const next = new Set(idsPreview)
    next.add(id)
    setEditStr(Array.from(next).join(", "))
  }
  function removeId(id){
    const next = idsPreview.filter(x => x !== id)
    setEditStr(next.join(", "))
  }

  return (
    <div className="container vstack" style={{gap:12}}>
      {/* Header */}
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Records</span>
          <h2 style={{margin:0}}>Featured Records</h2>
        </div>
        <div style={subtle}>
          This page shows a single curated set of standards. {canManage ? "Owner/Admin can edit the list and set records below." : ""}
        </div>
      </div>

      {/* Admin: choose which standards appear */}
      {canManage && (
        <div className="card vstack" style={{gap:10}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
            <span className="badge">Manage</span>
            <h3 style={{margin:0}}>Which standards are in Records?</h3>
          </div>

          <div className="vstack" style={{gap:6}}>
            <label style={subtle}>Standard IDs (comma-separated)</label>
            <input
              style={{...input, width:"100%"}}
              value={editStr}
              onChange={e=>setEditStr(e.target.value)}
              placeholder="deadlift, bench-press, mile-run …"
            />
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <button className="btn" onClick={saveRecordsSet} disabled={busy}>
                {busy ? "Saving…" : "Save list"}
              </button>
              <button className="btn" onClick={loadRecordsSet} disabled={busy}>Refresh</button>
            </div>
          </div>

          {/* Quick add from all standards (optional helper) */}
          <QuickStandards canManage={canManage} addId={addId} removeId={removeId} idsPreview={idsPreview} />
        </div>
      )}

      {/* Body */}
      {busy ? (
        <div className="card">Loading…</div>
      ) : err ? (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          {err.code === "permission-denied"
            ? "You must be signed in to view records. Try refreshing after login."
            : `Error: ${String(err.message || err)}`}
        </div>
      ) : standardIds.length === 0 ? (
        <div className="card">
          {canManage
            ? "No Records set yet. Add standard IDs above and Save."
            : "No Records have been set yet. Please check back later."}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">No records found for the selected standards.</div>
      ) : (
        <div className="grid" style={{
          display:"grid",
          gap:12,
          gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))"
        }}>
          {rows.map(r => (
            <div key={r.id} style={card}>
              <div className="vstack" style={{gap:8}}>
                <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline", gap:8, flexWrap:"wrap"}}>
                  <div style={{fontWeight:800}}>{r.title}</div>
                  {(r.tier || r.category) && (
                    <div className="hstack" style={{gap:6, flexWrap:"wrap"}}>
                      {r.tier && <span className="badge">{r.tier}</span>}
                      {r.category && <span className="badge">{r.category}</span>}
                    </div>
                  )}
                </div>

                {r.missing ? (
                  <div style={{color:"#fca5a5"}}>Standard not found: <code>{r.id}</code></div>
                ) : editId === r.id && canManage ? (
                  <Editor
                    form={form}
                    setForm={setForm}
                    onPickClick={ensureProfiles}
                    profiles={profiles}
                    saving={busy}
                    onCancel={cancelEdit}
                    onSave={()=>saveRecord(r.id)}
                  />
                ) : (
                  <>
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
                        <button className="btn" onClick={()=>beginEdit(r)}>Edit</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===== Small components ===== */

function QuickStandards({ canManage, addId, removeId, idsPreview }){
  const [allStd, setAllStd] = useState([])
  useEffect(() => {
    async function loadAll(){
      try {
        const qy = query(collection(db, "standards"), orderBy("title"))
        const snap = await getDocs(qy)
        setAllStd(snap.docs.map(d => ({ id: d.id, title: (d.data()?.title || d.id).toString() })))
      } catch {}
    }
    if (canManage) loadAll()
  }, [canManage])

  if (!canManage || allStd.length === 0) return null

  return (
    <div className="vstack" style={{gap:6}}>
      <div style={subtle}>Quick add from Standards</div>
      <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
        {allStd.map(s => {
          const active = idsPreview.includes(s.id)
          return (
            <button
              key={s.id}
              className="btn"
              onClick={() => active ? removeId(s.id) : addId(s.id)}
              style={{ opacity: active ? 0.6 : 1 }}
              title={s.id}
            >
              {active ? "✓ " : ""}{s.title}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Editor({ form, setForm, onPickClick, profiles, saving, onCancel, onSave }){
  return (
    <div className="vstack" style={{gap:10}}>
      <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
        <div className="vstack" style={{gap:6, flex:1, minWidth:120}}>
          <label style={subtle}>Value</label>
          <input
            style={input}
            inputMode="decimal"
            value={form.value}
            onChange={e => setForm(f => ({...f, value: e.target.value}))}
            placeholder="e.g., 405"
          />
        </div>
        <div className="vstack" style={{gap:6, minWidth:120}}>
          <label style={subtle}>Unit</label>
          <input
            style={input}
            value={form.unit}
            onChange={e => setForm(f => ({...f, unit: e.target.value}))}
            placeholder="lb, reps, sec, min…"
          />
        </div>
      </div>

      <div className="vstack" style={{gap:6}}>
        <label style={subtle}>Holder name</label>
        <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
          <input
            style={{...input, flex:1, minWidth:220}}
            value={form.holderName}
            onChange={e => setForm(f => ({...f, holderName: e.target.value}))}
            placeholder="Type a name or pick from members"
          />
          <details>
            <summary style={{...btnGhost, borderRadius:10, padding:"10px 12px"}} onClick={onPickClick}>
              Pick holder
            </summary>
            <div style={{background:"#0b1426", border:"1px solid #1f2937", borderRadius:10, padding:10, marginTop:8, maxHeight:220, overflowY:"auto", minWidth:260}}>
              {profiles.length === 0 ? (
                <div style={subtle}>No profiles loaded yet.</div>
              ) : (
                profiles.map(p => (
                  <div key={p.uid}
                    onClick={()=>setForm(f=>({...f, holderName: p.displayName}))}
                    style={{padding:"6px 8px", cursor:"pointer", borderRadius:8}}
                    className="hover"
                    title={p.uid}
                  >
                    {p.displayName} {p.tier ? <span style={{color:"#9ca3af"}}>· {p.tier}</span> : null}
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>

      <div className="vstack" style={{gap:6}}>
        <label style={subtle}>Notes (optional)</label>
        <textarea
          rows={3}
          style={{...input, fontFamily:"inherit", lineHeight:1.4}}
          value={form.notes}
          onChange={e => setForm(f => ({...f, notes: e.target.value}))}
          placeholder="Judged on …, depth to parallel, strict form, etc."
        />
      </div>

      <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
        <button className="btn" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save record"}</button>
        <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  )
}
