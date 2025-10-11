import { useEffect, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import { doc, setDoc, serverTimestamp, collection, onSnapshot, orderBy, query } from "firebase/firestore"

export default function Log(){
  const { user } = useAuth()
  const [score, setScore] = useState("")
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "profiles", user.uid, "weekly"), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, snap => setRows(snap.docs.map(d => ({ id:d.id, ...d.data() }))))
    return unsub
  }, [user])

  async function addEntry(e){
    e.preventDefault()
    if (!user || !score) return
    const id = new Date().toISOString().slice(0,10) // YYYY-MM-DD
    await setDoc(doc(db, "profiles", user.uid, "weekly", id), {
      score: Number(score), createdAt: serverTimestamp()
    }, { merge: true })
    setScore("")
  }

  return (
    <div className="container vstack">
      <div className="card vstack">
        <span className="badge">Log an entry</span>
        <form onSubmit={addEntry} className="hstack" style={{gap:8}}>
          <input type="number" min="0" placeholder="Score" value={score}
                 onChange={(e)=>setScore(e.target.value)}
                 style={{background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"8px 10px"}} />
          <button className="btn primary" disabled={!score}>Save</button>
        </form>
      </div>

      <div className="card vstack">
        <span className="badge">Recent</span>
        {rows.length === 0 ? <p style={{color:"#9ca3af"}}>No entries yet.</p> : (
          <ul className="vstack" style={{margin:0, padding:0, listStyle:"none"}}>
            {rows.map(r => (
              <li key={r.id} className="hstack" style={{justifyContent:"space-between", borderBottom:"1px solid #1f2937", padding:"8px 0"}}>
                <span>{r.id}</span>
                <b>{r.score}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
