// src/pages/Login.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import useAuth from "../lib/auth"
import { auth, db } from "../lib/firebase"
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,       // Apple
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"

const card = { padding:16, border:"1px solid #1f2937", borderRadius:12, background:"#0b1426" }
const btn  = { padding:"10px 12px", borderRadius:8, border:"1px solid #1f2937", background:"#172136", color:"#fff", cursor:"pointer" }
const row  = { display:"flex", gap:8, flexWrap:"wrap" }

async function upsertProfile(user) {
  const ref = doc(db, "profiles", user.uid)
  const snap = await getDoc(ref)
  // do not overwrite role if it exists
  const existingRole = snap.exists() ? snap.data()?.role : undefined
  await setDoc(ref, {
    displayName: user.displayName || user.email || "Member",
    email: user.email || null,
    photoURL: user.photoURL || null,
    role: existingRole || "member",
    updatedAt: serverTimestamp(),
    createdAt: snap.exists() ? snap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
  }, { merge: true })
}

function providerFor(name) {
  switch (name) {
    case "google":   return new GoogleAuthProvider()
    case "github":   return new GithubAuthProvider()
    case "facebook": return new FacebookAuthProvider()
    case "apple": {
      const p = new OAuthProvider("apple.com")
      p.addScope("email"); p.addScope("name")
      return p
    }
    default: throw new Error("Unknown provider: " + name)
  }
}

export default function Login() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)

  if (loading) {
    return (
      <div className="container card" style={{marginTop:16}}>
        <span className="badge">Loading…</span>
      </div>
    )
  }
  if (user) {
    navigate("/")
    return null
  }

  async function signIn(name) {
    setErr(null)
    setBusy(name)
    const prov = providerFor(name)
    try {
      // Popup (fallback to redirect for iOS/Safari)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      if ((isIOS || isSafari) && name === "apple") {
        await signInWithRedirect(auth, prov)
        return
      } else {
        const res = await signInWithPopup(auth, prov)
        await upsertProfile(res.user)
        navigate("/")
      }
    } catch (e) {
      console.error(e)
      setErr(e.message || String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520, marginTop: 24 }}>
      <div style={card} className="vstack">
        <h2 style={{ margin: "0 0 6px 0", color: "#fff" }}>Sign in</h2>
        <p style={{ margin: "0 0 12px 0", color: "#9ca3af" }}>
          Choose a provider below. Your profile will be created automatically.
        </p>

        <div style={row}>
          <button style={btn} onClick={() => signIn("google")}   disabled={busy!==null}>
            {busy==="google" ? "Signing in…" : "Continue with Google"}
          </button>
          <button style={btn} onClick={() => signIn("github")}   disabled={busy!==null}>
            {busy==="github" ? "Signing in…" : "Continue with GitHub"}
          </button>
          <button style={btn} onClick={() => signIn("facebook")} disabled={busy!==null}>
            {busy==="facebook" ? "Signing in…" : "Continue with Facebook"}
          </button>
          <button style={btn} onClick={() => signIn("apple")}    disabled={busy!==null}>
            {busy==="apple" ? "Signing in…" : "Continue with Apple"}
          </button>
        </div>

        {err && (
          <div className="card" style={{ marginTop:12, borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca" }}>
            {err}
          </div>
        )}

        <p style={{ margin: "12px 0 0 0", color: "#9ca3af", fontSize: 12 }}>
          Tip: Make sure your Firebase Auth providers are enabled and your Netlify domain is in Firebase Auth “Authorized domains”.
        </p>
      </div>
    </div>
  )
}
