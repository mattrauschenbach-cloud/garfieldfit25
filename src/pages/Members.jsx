// src/pages/Members.jsx
import { useEffect, useMemo, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import { collection, onSnapshot, orderBy, query, doc, setDoc } from "firebase/firestore"

const ROLES = ["member", "mentor", "admin", "owner"]

export default function Members(){
  const { user, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  const [qtext, setQtext] = useState("")
  const [busyUid, setBusyUid] = useState(null)
  const isOwner = profile?.role === "owner"

  useEffect(() => {
    if (!user) return
    setErr(null)
    const unsub = onSnapshot(
      query(collection(db, "profiles"), orderBy("displayName")),
      snap => setRows(snap.docs.map(d => ({ id:d.id, ...d.data() }))),
      e => setErr(e)
    )
    return unsub
  }, [user])

  // counts for safety: prevent demoting the last owner
  const ownersCount = useMemo(() => rows.filter(r => (r.role || "member") === "owner").length, [rows])

  const filtered = useMemo(() => {
    const q = qtext.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => {
      const name = (r.displayName || "").toLowerCase()
      const email = (r.email || "").toLowerCase()
      const role = (r.role || "member").toLowerCase()
      return name.includes(q) || email.includes(q) || role.includes(q)
    })
  }, [rows, qtext])

  async function updateRole(targetUid, nextRole){
    if (!isOwner) return // extra guard; UI already hides editor
    const current = rows.find(r => r.id === targetUid)
    if (!current) return
    const prevRole = current.role || "member"

    // No change
    if (prevRole === nextRole) return

    // Safety: don't allow demoting the last remaining owner (esp. yourself)
    if (prevRole === "owner" && nextRole !== "owner" && ownersCount === 1) {
      alert("You are the last owner. Add another owner first before demoting.")
      return
    }

    // Optional confirm when changing your own role
    if (targetUid === user.uid && prevRole === "owner" && nextRole !== "owner") {
      const ok = confirm("You’re changing your own role from OWNER. Are you sure?")
      if (!ok) return
    }

    try {
      setBusyUid(targetUid)
      await setDoc(doc(db, "profiles", targetUid), { role: nextRole }, { merge: true })
    } catch (e) {
      console.error("updateRole error:", e)
      alert(`Failed to update role: ${e.code || e.message}`)
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className="container vstack">
      <div className="card vstack">
        <div className="hstack" style={{justifyContent:"space-between", gap:12}}>
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <span className="badge">Members</span>
            <span className="badge">Visible: <b>{filtered.length}</b></span>
            <span className="badge">Owners: <b>{ownersCount}</b></span>
          </div>
          <input
            placeholder="Search name, email, role"
            value={qtext}
            onChange={e=>setQtext(e.target.value)}
            style={{background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
                    borderRadius:10, padding:"8px 10px", minWidth:220}}
          />
        </div>
        {!isOwner && (
          <p style={{color:"#9ca3af", margin:0, fontSize:13}}>
            All signed-in users can view everyone. Only <b>owner</b> can change roles.
          </p>
        )}
      </div>

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}

      <div className="card" style={{padding:0, overflowX:"auto"}}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#0f1a30"}}>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>UID</th>
              {isOwner ? <th style={th}></th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const role = r.role || "member"
              const editing = isOwner
              return (
                <tr key={r.id} style={{borderTop:"1px solid #1f2937"}}>
                  <td style={td}>{r.displayName || "—"}</td>
                  <td style={td}>{r.email || "—"}</td>

                  {/* Role cell: badge for non-owner, dropdown for owner */}
                  <td style={td}>
                    {!editing ? (
                      <span className="badge">{role}</span>
                    ) : (
                      <select
                        value={role}
                        onChange={e => updateRole(r.id, e.target.value)}
                        disabled={busyUid === r.id}
                        style={select}
                        title={r.id === r.uid ? "role" : undefined}
                      >
                        {ROLES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                  </td>

                  <td style={{...td, fontSize:12, color:"#9ca3af"}}>{r.id}</td>
                  {isOwner ? (
                    <td style={td}>
                      {busyUid === r.id ? <span className="badge">Saving…</span> : null}
                    </td>
                  ) : null}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td style={{...td, color:"#9ca3af"}} colSpan={isOwner ? 5 : 4}>No matches.</td></tr>
            )}
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
