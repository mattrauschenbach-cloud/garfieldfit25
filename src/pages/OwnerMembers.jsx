import { useEffect, useState, useMemo } from "react"
import { useAuth } from "../lib/auth"
import { db } from "../lib/firebase"
import {
  collection, query, orderBy, onSnapshot, doc, setDoc
} from "firebase/firestore"
import AccessDenied from "../components/AccessDenied"

const ROLES = ["member", "mentor", "admin", "owner"]

export default function OwnerMembers(){
  const { user, profile, loading } = useAuth()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(null) // uid while saving

  if (loading) return <div className="container"><div className="card">Loading…</div></div>
  if (!user || (profile?.role !== "owner"))
    return <AccessDenied reason="Owner access required." />

  useEffect(() => {
    const q = query(collection(db, "profiles"), orderBy("displayName"))
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRows(list)
    })
    return unsub
  }, [])

  async function updateRole(uid, role){
    if (!ROLES.includes(role)) return
    try {
      setBusy(uid)
      await setDoc(doc(db, "profiles", uid), { role }, { merge: true })
    } finally {
      setBusy(null)
    }
  }

  const totals = useMemo(() => {
    const t = { member:0, mentor:0, admin:0, owner:0 }
    rows.forEach(r => t[r.role || "member"] = (t[r.role || "member"]||0)+1)
    return t
  }, [rows])

  return (
    <div className="container vstack">
      <div className="card hstack" style={{justifyContent:"space-between"}}>
        <div className="hstack" style={{gap:8}}>
          <span className="badge">Members</span>
          <b>{rows.length}</b>
        </div>
        <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
          {ROLES.map(r => (
            <span key={r} className="badge">{r}: {totals[r]||0}</span>
          ))}
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#0f1a30"}}>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>UID</th>
              <th style={th}>Role</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{borderTop:"1px solid #1f2937"}}>
                <td style={td}>{r.displayName || "—"}</td>
                <td style={td}>{r.email || "—"}</td>
                <td style={{...td, fontSize:12, color:"#9ca3af"}}>{r.id}</td>
                <td style={td}>
                  <select
                    value={r.role || "member"}
                    onChange={e => updateRole(r.id, e.target.value)}
                    disabled={busy === r.id}
                    style={select}
                  >
                    {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
                <td style={td}>
                  {busy === r.id ? <span className="badge">Saving…</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th = { textAlign:"left", padding:"10px 12px", fontSize:12, color:"#9ca3af" }
const td = { padding:"12px" }
const select = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:8, padding:"8px 10px"
}
