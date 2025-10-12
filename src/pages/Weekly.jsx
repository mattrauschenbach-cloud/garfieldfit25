// src/pages/Weekly.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc
} from "firebase/firestore"

const inputStyle = { background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"8px 10px" }
const areaStyle  = { ...inputStyle, minHeight:90 }
const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af" }
const td = { padding:"10px 12px" }
const units = ["reps","minutes","miles","meters","rounds","seconds","kg","lb"]

function isoDate(d = new Date()) {
  const tz = new Date(d)
  const yyyy = tz.getFullYear()
  const mm = String(tz.getMonth()+1).padStart(2,"0")
  const dd = String(tz.getDate()).padStart(2,"0")
  return `${yyyy}-${mm}-${dd}`
}

export default function Weekly(){
  const { user, profile } = useAuth()
  const role = profile?.role || "member"
  const isOwner = role === "owner"
  const isMentor = ["mentor","admin","owner"].includes(role)

  // current week doc
  const [week, setWeek] = useState(null)     // { id, title, description, startDate, endDate, active, scoreMode, unit? }
  const [err, setErr]   = useState(null)
  const [busy, setBusy] = useState(null)

  // owner edit buffers
  const [wTitle, setWTitle] = useState("")
  const [wDesc, setWDesc]   = useState("")
  const [wStart, setWStart] = useState(isoDate())
  const [wEnd, setWEnd]     = useState("")
  const [wMode, setWMode]   = useState("higher_is_better") // or "lower_is_better"
  const [wUnit, setWUnit]   = useState(units[0])           // default unit for this week

  // logs for the current week
  const [logs, setLogs] = useState([]) // [{id, uid, displayName, value, unit, notes, createdAt, updatedAt}]
  // my new log editor
  const [myValue, setMyValue] = useState("")
  const [myUnit, setMyUnit]   = useState(units[0])
  const [myNotes, setMyNotes] = useState("")

  // ---- Subscribe to latest week (by startDate desc)
  useEffect(() => {
    const q = query(collection(db, "weeklyChallenges"), orderBy("startDate", "desc"), limit(1))
    const unsub = onSnapshot(q, snap => {
      const d = snap.docs[0]
      if (!d) { setWeek(null); return }
      const data = d.data()
      const row = {
        id: d.id,
        title: data.title || "Weekly Challenge",
        description: data.description || "",
        startDate: data.startDate || isoDate(),
        endDate: data.endDate || "",
        active: data.active !== false,
        scoreMode: data.scoreMode === "lower_is_better" ? "lower_is_better" : "higher_is_better",
        unit: data.unit || data.defaultUnit || units[0],
      }
      setWeek(row)
      // seed owner buffers
      setWTitle(row.title)
      setWDesc(row.description)
      setWStart(row.startDate)
      setWEnd(row.endDate)
      setWMode(row.scoreMode)
      setWUnit(row.unit)
      // seed my entry unit to week's unit
      setMyUnit(row.unit)
    }, e => setErr(e))
    return unsub
  }, [])

  // ---- Subscribe to all logs for current week
  useEffect(() => {
    if (!week?.id) { setLogs([]); return }
    const q = query(
      collection(db, "weeklyChallenges", week.id, "logs"),
      orderBy("updatedAt","desc")
    )
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()) }))
      setLogs(arr)
    }, e => setErr(e))
    return unsub
  }, [week?.id])

  // ---- Aggregations
  // totals per uid
  const totals = useMemo(() => {
    const map = new Map()
    for (const l of logs) {
      const v = Number(l.value)
      if (!Number.isFinite(v)) continue
      const prev = map.get(l.uid) || 0
      map.set(l.uid, prev + v)
    }
    return map // Map<uid, total>
  }, [logs])

  // leaderboard sorted by weekly score mode
  const leaderboard = useMemo(() => {
    // reduce to one row per uid with summed total
    const byUid = new Map()
    for (const l of logs) {
      const uid = l.uid
      const v = Number(l.value)
      if (!Number.isFinite(v)) continue
      const prev = byUid.get(uid) || { uid, displayName: l.displayName || uid, total: 0, unit: l.unit || week?.unit }
      prev.total += v
      byUid.set(uid, prev)
    }
    const arr = Array.from(byUid.values())
    arr.sort((a,b) => {
      if (week?.scoreMode === "lower_is_better") return a.total - b.total
      return b.total - a.total
    })
    return arr
  }, [logs, week?.scoreMode, week?.unit])

  const globalTotal = useMemo(() => {
    return leaderboard.reduce((a, r) => a + (Number(r.total) || 0), 0)
  }, [leaderboard])

  const myRank = useMemo(() => {
    if (!user) return null
    const idx = leaderboard.findIndex(e => e.uid === user.uid)
    return idx === -1 ? null : (idx + 1)
  }, [leaderboard, user?.uid])

  // ---- Owner actions
  async function createNewWeek(){
    if (!isOwner) return
    try{
      setBusy("create")
      if (week?.id && week.active) {
        await updateDoc(doc(db, "weeklyChallenges", week.id), { active:false, updatedAt: serverTimestamp() })
      }
      const id = wStart || isoDate()
      await setDoc(doc(db, "weeklyChallenges", id), {
        title: (wTitle || "Weekly Challenge").trim(),
        description: (wDesc || "").trim(),
        startDate: wStart || isoDate(),
        endDate: wEnd || "",
        scoreMode: wMode === "lower_is_better" ? "lower_is_better" : "higher_is_better",
        unit: wUnit || units[0],
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      alert("New weekly challenge created & set active.")
    }catch(e){
      alert(`Create failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  async function saveWeek(){
    if (!isOwner || !week?.id) return
    try{
      setBusy("save")
      await updateDoc(doc(db, "weeklyChallenges", week.id), {
        title: (wTitle || "Weekly Challenge").trim(),
        description: (wDesc || "").trim(),
        startDate: wStart || isoDate(),
        endDate: wEnd || "",
        scoreMode: wMode === "lower_is_better" ? "lower_is_better" : "higher_is_better",
        unit: wUnit || units[0],
        updatedAt: serverTimestamp(),
      })
      alert("Saved.")
    }catch(e){
      alert(`Save failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  async function setActive(next){
    if (!isOwner || !week?.id) return
    try{
      setBusy("active")
      await updateDoc(doc(db, "weeklyChallenges", week.id), { active: !!next, updatedAt: serverTimestamp() })
    }catch(e){
      alert(`Update failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  // ---- Member logging
  function parseValue(v) {
    if (v === "" || v == null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  async function addMyLog(e){
    e?.preventDefault?.()
    if (!user || !week?.id) return
    const val = parseValue(myValue)
    if (val === null) { alert("Enter a numeric value."); return }
    try{
      setBusy("addlog")
      await addDoc(collection(db, "weeklyChallenges", week.id, "logs"), {
        uid: user.uid,
        displayName: profile?.displayName || user.email || "Member",
        value: val,
        unit: myUnit || week?.unit || units[0],
        notes: myNotes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      // clear just the value/notes for quick repeat logging
      setMyValue("")
      setMyNotes("")
    }catch(e){
      alert(`Add failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  async function removeLog(logId, uid){
    if (!week?.id) return
    if (!(isOwner || isMentor || (user && user.uid === uid))) return
    try{
      setBusy(`del-${logId}`)
      await deleteDoc(doc(db, "weeklyChallenges", week.id, "logs", logId))
    }catch(e){
      alert(`Delete failed: ${e.code || e.message}`)
    }finally{
      setBusy(null)
    }
  }

  const activeBadge = week ? (
    <span className="badge" style={{marginLeft:8}}>{week.active ? "active" : "inactive"}</span>
  ) : null

  return (
    <div className="container vstack">
      {/* Header */}
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <span className="badge">Weekly</span>
            {week?.id && <span className="badge">Week ID: {week.id}</span>}
            {activeBadge}
            {week && <span className="badge">Mode: {week.scoreMode === "lower_is_better" ? "Lower is better" : "Higher is better"}</span>}
            {week && <span className="badge">Unit: {week.unit}</span>}
            <span className="badge">Total this week: {globalTotal} {week?.unit || ""}</span>
          </div>

          {isOwner && (
            <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
              <button className="btn" disabled={busy==="active" || !week} onClick={()=>setActive(!(week?.active))}>
                {busy==="active" ? "Saving…" : (week?.active ? "Set Inactive" : "Set Active")}
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
              <input value={wTitle} onChange={e=>setWTitle(e.target.value)} style={inputStyle} placeholder="e.g., Total Miles This Week"/>
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
              <label className="vstack">
                <span style={{color:"#9ca3af", fontSize:12}}>Score mode</span>
                <select value={wMode} onChange={e=>setWMode(e.target.value)} style={inputStyle}>
                  <option value="higher_is_better">Higher is better</option>
                  <option value="lower_is_better">Lower is better</option>
                </select>
              </label>
              <label className="vstack">
                <span style={{color:"#9ca3af", fontSize:12}}>Unit for this week</span>
                <select value={wUnit} onChange={e=>setWUnit(e.target.value)} style={inputStyle}>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
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
                <h3 style={{margin:"4px 0"}}>{week.title}</h3>
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

      {/* Add my log */}
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", alignItems:"center"}}>
          <span className="badge">Add a log</span>
          {myRank != null && <span className="badge">Your rank: #{myRank}</span>}
        </div>

        {!user ? (
          <p style={{color:"#9ca3af"}}>Sign in to log.</p>
        ) : !week ? (
          <p style={{color:"#9ca3af"}}>No active week to log to.</p>
        ) : (
          <form className="hstack" style={{gap:8, flexWrap:"wrap"}} onSubmit={addMyLog}>
            <input
              type="number"
              step="any"
              placeholder={`Value (${week.unit})`}
              value={myValue}
              onChange={e=>setMyValue(e.target.value)}
              style={{...inputStyle, minWidth:140}}
            />
            <select value={myUnit} onChange={e=>setMyUnit(e.target.value)} style={{...inputStyle, minWidth:130}}>
              {/* lock to week's unit by default, but keep options if you insist */}
              {[week.unit, ...units.filter(u => u !== week.unit)].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input
              placeholder="Notes (optional)"
              value={myNotes}
              onChange={e=>setMyNotes(e.target.value)}
              style={{...inputStyle, minWidth:260, flex:1}}
            />
            <button className="btn primary" disabled={busy==="addlog"}>{busy==="addlog" ? "Saving…" : "Add log"}</button>
          </form>
        )}
      </div>

      {/* My logs */}
      {user && week && (
        <div className="card vstack">
          <div className="hstack" style={{justifyContent:"space-between"}}>
            <span className="badge">My logs</span>
            <span className="badge">My total: {totals.get(user.uid) || 0} {week.unit}</span>
          </div>
          {logs.filter(l => l.uid === user.uid).length === 0 ? (
            <p style={{color:"#9ca3af"}}>No logs yet.</p>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%", borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#0f1a30"}}>
                    <th style={th}>Value</th>
                    <th style={th}>Unit</th>
                    <th style={th}>Notes</th>
                    <th style={th}>Updated</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.filter(l => l.uid === user.uid).map(l => (
                    <tr key={l.id} style={{borderTop:"1px solid #1f2937"}}>
                      <td style={td}>{l.value}</td>
                      <td style={td}>{l.unit}</td>
                      <td style={td}>{l.notes || "—"}</td>
                      <td style={td}>{l.updatedAt?.toDate ? l.updatedAt.toDate().toLocaleString() : "—"}</td>
                      <td style={td}>
                        <button
                          className="btn"
                          disabled={busy===`del-${l.id}`}
                          onClick={()=>removeLog(l.id, l.uid)}
                        >
                          {busy===`del-${l.id}` ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard (week totals) */}
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between"}}>
          <span className="badge">Leaderboard (weekly totals)</span>
          <span className="badge">Participants: {leaderboard.length}</span>
        </div>

        {(!week || leaderboard.length === 0) ? (
          <p style={{color:"#9ca3af"}}>No logs yet.</p>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#0f1a30"}}>
                  <th style={th}>#</th>
                  <th style={th}>Member</th>
                  <th style={th}>Total</th>
                  <th style={th}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.uid} style={{borderTop:"1px solid #1f2937"}}>
                    <td style={td}><b>{i+1}</b></td>
                    <td style={td}>{r.displayName}</td>
                    <td style={td}>{r.total}</td>
                    <td style={td}>{r.unit || (week?.unit || "")}</td>
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
