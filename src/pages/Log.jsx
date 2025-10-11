import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import {
  doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  collection, onSnapshot, orderBy, query
} from "firebase/firestore"

function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` }

export default function Log(){
  const { user } = useAuth()
  const [score, setScore] = useState("")
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState(null) // doc id being edited
  const [editScore, setEditScore] = useState("")
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, "profiles", user.uid, "weekly"),
      orderBy("createdAt", "desc")
    )
    const unsub = onSnapshot(q,
      snap => setRows(snap.docs.map(d => ({ id:d.id, ...d.data() }))),
      e => setErr(e)
    )
    return unsub
  }, [user])

  // Totals
  const totals = useMemo(() => {
    const now = new Date()
    const mk = monthKey(now)
    let thisMonth = 0, overall = 0
    rows.forEach(r => {
      const s = Number(r.score) || 0
      overall += s
      const idDate = /^\d{4}-\d{2}-\d{2}$/.test(r.id) ? new Date(`${r.id}T00:00:00`) : null
      const d = idDate || (r.createdAt?.toDate ? r.createdAt.toDate() : null)
      if (d && monthKey(d) === mk) thisMonth += s
    })
    return { overall, thisMonth }
  }, [rows])

  async function addEntry(e){
    e.preventDefault()
    if (!user || !score) return
    const id = new Date().toISOString().slice(0,10) // one doc per day
    await setDoc(doc(db, "profiles", user.uid, "weekly", id), {
      score: Number(score),
      createdAt: serverTimestamp()
    }, { merge: true })
    setScore("")
  }

  function startEdit(row){
    setEditing(row.id)
    setEditScore(String(row.score ?? ""))
  }

  async function saveEdit(){
    if (!editing || editScore === "") return
    await updateDoc(
      doc(db, "profiles", user.uid, "weekly", editing),
      { score: Number(editScore) }
    )
    setEditing(null)
    setEditScore("")
  }

  async function remove(id){
    if (!confirm("Delete this entry?")) return
    await deleteDoc(doc(db, "profiles", user.uid, "weekly", id))
  }

  return (
    <div className="container vstack">
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", gap:12}}>
          <span className="badge">Log an entry</span>
          <div className="hstack" style={{gap:8}}>
            <span className="badge">This month: <b>{totals.thisMonth}</b></span>
            <span className="badge">Overall: <b>{totals.overall}</b></span>
          </div>
        </div>

        <form onSubmit={addEntry} className="hstack" style={{gap:8}}>
          <input
            type="number" min="0" placeholder="Score"
            value={score} onChange={(e)=>setScore(e.target.value)}
            style={{background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"8px 10px", width:140}}
          />
          <button className="btn primary" disabled={!score}>Save</button>
        </form>

        <p style={{color:"#9ca3af", margin:0}}>One entry per day (uses today’s date as the key).</p>
      </div>

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}

      <div className="card vstack">
        <span className="badge">Recent</span>
        {rows.length === 0 ? (
          <p style={{color:"#9ca3af"}}>No entries yet.</p>
        ) : (
          <ul className="vstack" style={{margin:0, padding:0, listStyle:"none"}}>
            {rows.map(r => {
              const isEditing = editing === r.id
              return (
                <li key={r.id} className="hstack" style={{justifyContent:"space-between", gap:12, borderBottom:"1px solid #1f2937", padding:"8px 0"}}>
                  <div className="hstack" style={{gap:10}}>
                    <span className="badge">Day</span>
                    <span>{r.id}</span>
                  </div>

                  {!isEditing ? (
                    <div className="hstack" style={{gap:8}}>
                      <b>{r.score}</b>
                      <button className="btn ghost" onClick={()=>startEdit(r)}>Edit</button>
                      <button className="btn" onClick={()=>remove(r.id)}>Delete</button>
                    </div>
                  ) : (
                    <div className="hstack" style={{gap:8}}>
                      <input
                        type="number" min="0" value={editScore}
                        onChange={e=>setEditScore(e.target.value)}
                        style={{background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"6px 8px", width:120}}
                      />
                      <button className="btn primary" onClick={saveEdit}>Save</button>
                      <button className="btn ghost" onClick={()=>{ setEditing(null); setEditScore("") }}>Cancel</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
