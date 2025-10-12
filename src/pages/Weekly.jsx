// src/pages/Weekly.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc
} from "firebase/firestore"

const inputStyle = { background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"8px 10px" }
const areaStyle  = { ...inputStyle, minHeight:90 }
const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af" }
const td = { padding:"10px 12px" }
const units = ["reps","minutes","miles","meters","rounds"]

function isoDate(d = new Date()) {
  const tz = new Date(d) // keep local
  const yyyy = tz.getFullYear()
  const mm = String(tz.getMonth()+1).padStart(2,"0")
  const dd = String(tz.getDate()).padStart(2,"0")
  return `${yyyy}-${mm}-${dd}`
}

export default function Weekly(){
  const { user, profile } = useAuth()
  const isOwner = profile?.role === "owner"

  // Current active (or latest) week
  const [week, setWeek] = useState(null)         // {id, ...data}
  const [err, setErr]   = useState(null)
  const [busy, setBusy] = useState(null)

  // Owner edit buffers
  const [wTitle, setWTitle] = useState("")
  const [wDesc, setWDesc]   = useState("")
  const [wStart, setWStart] = useState(isoDate())
  const [wEnd, setWEnd]     = useState("")

  // Entries for everyone to see
  const [entries, setEntries] = useState([])     // [{id: uid, displayName, value, unit, notes, updatedAt}]
  // My submission editors
  const [myValue, setMyValue] = useState("")
  const [myUnit, setMyUnit]   = useState(units[0])
  const [myNotes, setMyNotes] = useState("")

  // ---- Subscribe to the latest weekly challenge (by startDate desc, limit 1)
  useEffect(() => {
    const q = query(collection(db, "weeklyChallenges"), orderBy("startDate", "desc"), limit(1))
    const unsub = onSnapshot(q, snap => {
      const docSnap = snap.docs[0]
      if (!docSnap) { setWeek(null); return }
      const data = docSnap.data()
      const row = { id: docSnap.id, ...data }
      setWeek(row)
      // populate edit buffers for owner
      setWTitle(data.title || "")
      setWDesc(data.description || "")
      setWStart(data.startDate || isoDate())
      setWEnd(data.endDate || "")
    }, e => setErr(e))
    return unsub
  }, [])

  // ---- Subscribe to entries for current week
  useEffect(() => {
    if (!week?.id) { setEntries([]); return }
    const q = query(collection(db, "weeklyChallenges", week.id, "entries"), orderBy("updatedAt","desc"))
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()) }))
      setEntries(arr)
      // set my own buffer from existing record if present
      if (user) {
        const mine = arr.find(e => e.id === user.uid)
        if (mine) {
          if (mine.value != null) setMyValue(String(mine.value))
          if (mine.unit) setMyUnit(mine.unit)
          if (mine.notes != null) setMyNotes(mine.notes)
        }
      }
    }, e => setErr(e))
    return unsub
  }, [week?.id, user?.uid])

  // ---- Owner: create a new weekly challenge (deactivate current if exists)
  async function createNewWeek(){
    if (!isOwner) return
    try{
      setBusy("create")
      // deactivate current week if exists
      if (week?.id && week.active !== false) {
        await updateDoc(doc(db, "weeklyChallenges", week.id), { active:false, updatedAt: serverTimestamp() })
      }
      // new doc id based on start date for readability
      const id = wStart || isoDate()
      await setDoc(doc(db, "weeklyChallenges", id), {
        title: wTitle.trim() || "Weekly Challenge",
        description: wDesc.trim() || "",
        startDate: wStart || isoDate(),
        endDate: wEnd || "",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      // UI state will refresh via onSnapshot
      alert("New weekly challenge created & set active.")
    }catch(e){
      alert(`Create failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  // ---- Owner: save edits to current week
  async function saveWeek(){
    if (!isOwner || !week?.id) return
    try{
      setBusy("save")
      await updateDoc(doc(db, "weeklyChallenges", week.id), {
        title: wTitle.trim() || "Weekly Challenge",
        description: wDesc.trim() || "",
        startDate: wStart || isoDate(),
        endDate: wEnd || "",
        updatedAt: serverTimestamp(),
      })
      alert("Saved.")
    }catch(e){
      alert(`Save failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  // ---- Owner: toggle active
  async function setActive(next){
    if (!isOwner || !week?.id) return
    try{
      setBusy("active")
      await updateDoc(doc(db, "weeklyChallenges", week.id), { active: next, updatedAt: serverTimestamp() })
    }catch(e){
      alert(`Update failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  // ---- Member: submit/update my entry
  async function saveMyEntry(e){
    e?.preventDefault?.()
    if (!user || !week?.id) return
    try{
      setBusy("entry")
      await setDoc(
        doc(db, "weeklyChallenges", week.id, "entries", user.uid),
        {
          displayName: profile?.displayName || user.email || "Member",
          value: myValue === "" ? null : Number(myValue),
          unit: myUnit,
          notes: myNotes || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    }catch(e){
      alert(`Update failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  const activeBadge = useMemo(() => {
    if (!week) return null
    return (
      <span className="badge" style={{marginLeft:8}}>
        {week.active === false ? "inactive" : "active"}
      </span>
    )
  }, [week])

  return (
    <div className="container vstack">
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <span className="badge">Weekly</span>
            {week?.id && <span className="badge">Week ID: {week.id}</span>}
            {activeBadge}
          </div>
          {isOwner && (
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <button className="btn" disabled={busy==="active" || !week} onClick={()=>setActive(!(week?.active !== false))}>
                {busy==="active" ? "Saving…" : (week?.active === false ? "Set Active" : "Set Inactive")}
              </button>
              <button className="btn primary" disabled={busy==="create"} onClick={createNewWeek}>
                {busy==="create" ? "Creating…" : "Create New Week"}
              </button>
            </div>
          )}
        </div>

        {/* Owner editor */}
        {isOwner ? (
          <div className="vstack" style={{gap:8, marginTop:10}}>
            <label className="vstack">
              <span style={{color:"#9ca3af", fontSize:12}}>Title</span>
              <input value={wTitle} onChange={e=>setWTitle(e.target.value)} style={inputStyle} placeholder="e.g., 1.5 Mile Run for Time"/>
            </label>
            <label className="vstack">
              <span style={{color:"#9ca3af", fontSize:12}}>Description</span>
              <textarea value={wDesc} onChange={e=>setWDesc(e.target.value)} style={areaStyle} placeholder="Explain the challenge, standards, tips…"/>
            </label>
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <label className="vstack">
                <span style={{color:"#9ca3af", fontSize:12}}>Start date</span>
                <input type="date" value={wStart} onChange={e=>setWStart(e.target.value)} style={inputStyle}/>
              </label>
              <label className="vstack">
                <span style={{color:"#9ca3af", fontSize:12}}>End date (optional)</span>
                <input type="date" value={wEnd} onChange={e=>setWEnd(e.target.value)} style={inputStyle}/>
              </label>
            </div>
            <div className="hstack" style={{gap:8}}>
              <button className="btn primary" onClick={saveWeek} disabled={busy==="save" || !week?.id}>
                {busy==="save" ? "Saving…" : "Save Week"}
              </button>
            </div>
          </div>
        ) : (
          <div className="vstack" style={{gap:6, marginTop:6}}>
            {week ? (
              <>
                <h3 style={{margin:"4px 0"}}>{week.title || "Weekly Challenge"}</h3>
                {week.description && <p style={{marginTop:0, color:"#cbd5e1"}}>{week.description}</p>}
                <div className="hstack" style={{gap:8, color:"#9ca3af", fontSize:13}}>
                  {week.startDate && <span>Start: {week.startDate}</span>}
                  {week.endDate && <span>End: {week.endDate}</span>}
                </div>
              </>
            ) : (
              <p style={{color:"#9ca3af"}}>No weekly challenge yet.</p>
            )}
          </div>
        )}
      </div>

      {/* My submission */}
      <div className="card vstack">
        <span className="badge">Submit your progress</span>
        {!user ? (
          <p style={{color:"#9ca3af"}}>Sign in to submit.</p>
        ) : !week ? (
          <p style={{color:"#9ca3af"}}>No active week to submit to.</p>
        ) : (
          <form className="hstack" style={{gap:8, flexWrap:"wrap"}} onSubmit={saveMyEntry}>
            <input
              type="number"
              step="any"
              placeholder="Value (e.g., 12.5)"
              value={myValue}
              onChange={e=>setMyValue(e.target.value)}
              style={{...inputStyle, minWidth:140}}
            />
            <select value={myUnit} onChange={e=>setMyUnit(e.target.value)} style={{...inputStyle, minWidth:130}}>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input
              placeholder="Notes (optional)"
              value={myNotes}
              onChange={e=>setMyNotes(e.target.value)}
              style={{...inputStyle, minWidth:260, flex:1}}
            />
            <button className="btn primary" disabled={busy==="entry"}>{busy==="entry" ? "Saving…" : "Save"}</button>
          </form>
        )}
      </div>

      {/* Leaderboard / everyone’s entries */}
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between"}}>
          <span className="badge">Submissions</span>
          <span className="badge">Total: {entries.length}</span>
        </div>
        {(!week || entries.length === 0) ? (
          <p style={{color:"#9ca3af"}}>No submissions yet.</p>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#0f1a30"}}>
                  <th style={th}>Member</th>
                  <th style={th}>Value</th>
                  <th style={th}>Unit</th>
                  <th style={th}>Notes</th>
                  <th style={th}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} style={{borderTop:"1px solid #1f2937"}}>
                    <td style={td}>{e.displayName || e.id}</td>
                    <td style={td}>{e.value ?? "—"}</td>
                    <td style={td}>{e.unit || "—"}</td>
                    <td style={td}>{e.notes || "—"}</td>
                    <td style={td}>{e.updatedAt?.toDate ? e.updatedAt.toDate().toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}
    </div>
  )
}
