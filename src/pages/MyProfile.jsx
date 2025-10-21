// src/pages/MyProfile.jsx
import { useEffect, useState } from "react"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"

const subtle = { color:"#9ca3af", fontSize:12 }
const input = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:10, padding:"10px 12px"
}
const card = { background:"#0f1a30", border:"1px solid #1f2937", borderRadius:14, padding:14 }

const ROLE_OPTIONS = ["owner","admin","mentor","member"]
const TIER_OPTIONS = ["committed","developmental","advanced","elite"]

export default function MyProfile(){
  const { user, profile, loading } = useAuth()

  // Treat the viewer as "owner-like" if their loaded profile says role === 'owner'
  // (This avoids cases where useAuth.isOwner is stale or not populated yet.)
  const ownerLike = (profile?.role === "owner")

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [local, setLocal] = useState({
    displayName: "",
    tier: "committed",
    role: "member"
  })

  // seed profile if missing
  useEffect(() => {
    async function seedIfMissing(){
      if (!user || loading) return
      const ref = doc(db, "profiles", user.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, {
          displayName: user.displayName || user.email || "Member",
          email: user.email || null,
          tier: "committed",
          role: "member",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true })
      }
    }
    seedIfMissing()
  }, [user, loading])

  // sync local form from profile
  useEffect(() => {
    if (!profile) return
    setLocal({
      displayName: profile.displayName || "",
      tier: profile.tier || "committed",
      role: profile.role || "member",
    })
  }, [profile?.displayName, profile?.tier, profile?.role])

  if (loading) return <div className="container"><div className="card">Loading…</div></div>
  if (!user) return <div className="container"><div className="card">Please sign in to view your profile.</div></div>

  async function saveBasics(){
    setBusy(true); setErr(null)
    try {
      const ref = doc(db, "profiles", user.uid)
      await updateDoc(ref, {
        displayName: (local.displayName || "").trim(),
        tier: local.tier,
        updatedAt: serverTimestamp()
      })
      alert("Saved.")
    } catch (e) {
      setErr(e); alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setRole(nextRole){
    if (!ownerLike) return // UI guard; rules also enforce this
    setBusy(true); setErr(null)
    try {
      const ref = doc(db, "profiles", user.uid)
      await updateDoc(ref, {
        role: nextRole,
        updatedAt: serverTimestamp()
      })
      setLocal(v => ({ ...v, role: nextRole }))
    } catch (e) {
      setErr(e); alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container vstack" style={{gap:12}}>
      {/* Header */}
      <div className="card vstack" style={{gap:6}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", flexWrap:"wrap"}}>
          <span className="badge">Profile</span>
          <h2 style={{margin:0}}>My Profile</h2>
        </div>
        <div style={subtle}>
          Update your display name, tier, and (owner only) switch roles to test different views.
        </div>
      </div>

      {/* Basics */}
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
            <span className="badge">Basics</span>
            <h3 style={{margin:0}}>Your Info</h3>
          </div>
          <button className="btn" onClick={saveBasics} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="vstack" style={{gap:10}}>
          <div className="vstack" style={{gap:6}}>
            <label style={subtle}>Display name</label>
            <input
              style={input}
              value={local.displayName}
              onChange={e=>setLocal(s=>({...s, displayName: e.target.value}))}
              placeholder="Your name"
            />
          </div>

          <div className="vstack" style={{gap:6}}>
            <label style={subtle}>Tier</label>
            <select
              style={input}
              value={local.tier}
              onChange={e=>setLocal(s=>({...s, tier: e.target.value}))}
            >
              {TIER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid" style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
            <div className="vstack" style={{gap:4}}>
              <div style={subtle}>Email</div>
              <div style={{color:"#e5e7eb"}}>{user.email || "—"}</div>
            </div>
            <div className="vstack" style={{gap:4}}>
              <div style={subtle}>UID</div>
              <div style={{color:"#9ca3af", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}} title={user.uid}>
                {user.uid}
              </div>
            </div>
            <div className="vstack" style={{gap:4}}>
              <div style={subtle}>Current role</div>
              <div style={{color:"#e5e7eb", fontWeight:700}}>{local.role}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Role toggle */}
      <div className="card vstack" style={{gap:10}}>
        <div className="hstack" style={{gap:8, alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap"}}>
          <div className="hstack" style={{gap:8, alignItems:"baseline"}}>
            <span className="badge">Role</span>
            <h3 style={{margin:0}}>View As</h3>
          </div>
        </div>

        {!ownerLike ? (
          <div style={subtle}>
            Only the <b>owner</b> can change roles. Your role is <b>{local.role}</b>.
          </div>
        ) : (
          <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
            {ROLE_OPTIONS.map(r => (
              <button
                key={r}
                className="btn"
                onClick={()=>setRole(r)}
                disabled={busy}
                style={{opacity: local.role === r ? 0.7 : 1}}
                title={`Switch your role to ${r}`}
              >
                {local.role === r ? "✓ " : ""}{r}
              </button>
            ))}
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
