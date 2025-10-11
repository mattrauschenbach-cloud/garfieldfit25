// src/pages/MyProfile.jsx
import { useEffect, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import { doc, setDoc } from "firebase/firestore"

const ROLES = ["member", "mentor", "admin", "owner"]

export default function MyProfile(){
  const { user, profile } = useAuth()
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState("member")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || "")
    setRole(profile?.role || "member")
  }, [user, profile])

  if (!user) return null

  async function saveBasics(e){
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      await setDoc(doc(db, "profiles", user.uid), { displayName: displayName || null }, { merge: true })
      setMsg({ type:"ok", text:"Saved name." })
    } catch (e) {
      setMsg({ type:"err", text: e.code || e.message })
    } finally { setSaving(false) }
  }

  async function saveRole(e){
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      await setDoc(doc(db, "profiles", user.uid), { role }, { merge: true })
      setMsg({ type:"ok", text:`Saved role: ${role}` })
    } catch (e) {
      setMsg({ type:"err", text: e.code || e.message })
    } finally { setSaving(false) }
  }

  return (
    <div className="container vstack">
      <div className="card vstack">
        <span className="badge">My Profile</span>

        <div className="hstack" style={{gap:12, flexWrap:"wrap"}}>
          <div className="vstack" style={{minWidth:280}}>
            <label className="badge">Display name</label>
            <form onSubmit={saveBasics} className="hstack" style={{gap:8}}>
              <input
                value={displayName}
                onChange={e=>setDisplayName(e.target.value)}
                placeholder="Your name"
                style={{
                  background:"#0b1426", color:"#e5e7eb",
                  border:"1px solid #1f2937", borderRadius:10,
                  padding:"8px 10px", minWidth:220
                }}
              />
              <button className="btn primary" disabled={saving}>Save</button>
            </form>
          </div>

          <div className="vstack" style={{minWidth:280}}>
            <label className="badge">Role</label>
            <form onSubmit={saveRole} className="hstack" style={{gap:8}}>
              <select
                value={role}
                onChange={e=>setRole(e.target.value)}
                disabled={saving}
                style={{
                  background:"#0b1426", color:"#e5e7eb",
                  border:"1px solid #1f2937", borderRadius:10,
                  padding:"8px 10px", minWidth:220
                }}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button className="btn" disabled={saving}>Save</button>
            </form>
            <p style={{color:"#9ca3af", margin:0, fontSize:13}}>
              Role changes may be restricted by Firestore rules unless you’re owner.
            </p>
          </div>
        </div>

        <div className="hstack" style={{gap:8, flexWrap:"wrap", marginTop:8}}>
          <span className="badge">UID: {user.uid}</span>
          <span className="badge">Email: {user.email || "—"}</span>
          <span className="badge">Current role: {profile?.role || "member"}</span>
        </div>

        {msg && (
          <div
            className="card"
            style={{
              marginTop:12,
              borderColor: msg.type === "ok" ? "#064e3b" : "#7f1d1d",
              background: msg.type === "ok" ? "#062b24" : "#1f1315",
              color: msg.type === "ok" ? "#A7F3D0" : "#fecaca"
            }}
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
