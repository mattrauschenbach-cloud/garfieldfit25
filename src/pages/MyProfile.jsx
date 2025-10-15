// src/pages/MyProfile.jsx
import { useEffect, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"

const label = { fontSize:12, color:"#9ca3af", marginBottom:6 }
const input = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:10, padding:"10px 12px", width:"100%"
}

const TIER_OPTIONS = ["committed", "developmental", "advanced", "elite"]

export default function MyProfile(){
  const { user, profile } = useAuth()
  const [state, setState] = useState({
    displayName: "",
    tier: "committed",
    photoURL: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let alive = true
    async function run(){
      if (!user?.uid) return
      try {
        setLoading(true)
        const ref = doc(db, "profiles", user.uid)
        const snap = await getDoc(ref)
        const data = snap.exists() ? snap.data() : {}
        const next = {
          displayName: data.displayName || profile?.displayName || user.email || "",
          tier: (data.tier || "committed").toString(),
          photoURL: data.photoURL || ""
        }
        if (alive) { setState(next); setErr(null) }
      } catch (e) {
        if (alive) setErr(e)
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [user?.uid, profile?.displayName, user?.email])

  async function save(){
    if (!user?.uid) return
    setSaving(true); setOk(false); setErr(null)
    try {
      const ref = doc(db, "profiles", user.uid)
      await setDoc(ref, {
        displayName: (state.displayName || "").trim(),
        tier: state.tier,
        photoURL: (state.photoURL || "").trim(),
        updatedAt: serverTimestamp()
      }, { merge: true })
      setOk(true)
    } catch (e) {
      setErr(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container vstack" style={{gap:12}}>
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Profile</span>
          <h2 style={{margin:0}}>My Profile</h2>
        </div>
        <div style={{color:"#9ca3af", fontSize:12}}>
          Update your display name, photo, and tier. Roles are managed by the owner/admin.
        </div>
      </div>

      {loading ? (
        <div className="card">Loading…</div>
      ) : (
        <div className="card vstack" style={{gap:12}}>
          <div className="vstack" style={{gap:6}}>
            <label style={label}>Display name</label>
            <input
              style={input}
              value={state.displayName}
              onChange={e => setState(s => ({...s, displayName: e.target.value}))}
              placeholder="Your name"
            />
          </div>

          <div className="vstack" style={{gap:6}}>
            <label style={label}>Photo URL (optional)</label>
            <input
              style={input}
              value={state.photoURL}
              onChange={e => setState(s => ({...s, photoURL: e.target.value}))}
              placeholder="https://…"
            />
          </div>

          <div className="vstack" style={{gap:6}}>
            <label style={label}>Tier</label>
            <select
              style={input}
              value={state.tier}
              onChange={e => setState(s => ({...s, tier: e.target.value}))}
            >
              {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            {ok && <span style={{color:"#86efac"}}>Saved!</span>}
          </div>

          {err && (
            <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
              Error: {String(err.message || err)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
