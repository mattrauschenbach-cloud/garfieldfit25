// src/pages/Leaderboard.jsx
import { useEffect, useState } from "react"
import { db } from "../lib/firebase"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"

const subtle = { color:"#9ca3af", fontSize:12 }
const table = { width:"100%", borderCollapse:"collapse" }
const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af", borderBottom:"1px solid #1f2937", background:"#0f1a30" }
const td = { padding:"10px 12px", borderBottom:"1px solid #1f2937" }

export default function Leaderboard(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    async function run(){
      try {
        setLoading(true)
        // We’ll read all standards, and for each look for record/"current"
        const stdSnap = await getDocs(collection(db, "standards"))
        const tmp = []
        for (const s of stdSnap.docs) {
          const data = s.data() || {}
          const recRef = doc(db, "standards", s.id, "record", "current")
          const recSnap = await getDoc(recRef)
          const rec = recSnap.exists() ? recSnap.data() : null
          tmp.push({
            id: s.id,
            title: data.title || s.id,
            tier: (data.tier || "").toString(),
            category: (data.category || "").toString(),
            unit: rec?.unit || data.unit || "",
            holderName: rec?.holderName || "—",
            value: rec?.value ?? "—",
            notes: rec?.notes || "",
            updatedAt: rec?.updatedAt?.toDate?.()?.toLocaleString?.() || ""
          })
        }
        if (alive) { setRows(tmp); setErr(null) }
      } catch (e) {
        if (alive) setErr(e)
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [])

  return (
    <div className="container vstack" style={{gap:12}}>
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Leaderboard</span>
          <h2 style={{margin:0}}>Standards Records</h2>
        </div>
        <div style={subtle}>Top marks per standard (owner can manage in Standards).</div>
      </div>

      {loading ? (
        <div className="card">Loading…</div>
      ) : err ? (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">No standards found.</div>
      ) : (
        <div className="card" style={{padding:0, overflowX:"auto"}}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Standard</th>
                <th style={th}>Tier</th>
                <th style={th}>Category</th>
                <th style={th}>Record</th>
                <th style={th}>Holder</th>
                <th style={th}>Updated</th>
                <th style={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={td}><b>{r.title}</b></td>
                  <td style={td} className="capitalize">{r.tier || "—"}</td>
                  <td style={td} className="capitalize">{r.category || "—"}</td>
                  <td style={td}><b>{r.value}</b> {r.unit}</td>
                  <td style={td}>{r.holderName}</td>
                  <td style={td}>{r.updatedAt}</td>
                  <td style={td}>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
