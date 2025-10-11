import { useEffect, useMemo, useState } from "react"
import { collectionGroup, getDocs } from "firebase/firestore"
import { db } from "../lib/firebase"

export default function Leaderboard(){
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => {
    (async () => {
      try{
        const snap = await getDocs(collectionGroup(db, "weekly"))
        const byUser = new Map()
        snap.forEach(docSnap => {
          const parts = docSnap.ref.path.split("/") // profiles/{uid}/weekly/{doc}
          const uid = parts[1]
          const score = Number(docSnap.data().score) || 0
          byUser.set(uid, (byUser.get(uid) || 0) + score)
        })
        const arr = Array.from(byUser.entries()).map(([uid, total]) => ({ uid, total }))
        arr.sort((a,b)=>b.total - a.total)
        setRows(arr.slice(0, 20))
      }catch(e){ setErr(e) }
    })()
  }, [])

  return (
    <div className="container vstack">
      <div className="card"><span className="badge">Leaderboard</span></div>
      {err && <div className="card" style={{color:"#fecaca", background:"#1f1315"}}>Error: {String(err.message||err)}</div>}
      <div className="card">
        {rows.length === 0 ? <p style={{color:"#9ca3af"}}>No data yet.</p> : (
          <ol className="vstack" style={{margin:0, paddingLeft:18}}>
            {rows.map((r, i) => (
              <li key={r.uid} className="hstack" style={{justifyContent:"space-between"}}>
                <span>#{i+1} — <code style={{fontSize:12}}>{r.uid}</code></span>
                <b>{r.total}</b>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
