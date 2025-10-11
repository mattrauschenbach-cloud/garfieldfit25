import { useEffect, useState } from "react"
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from "firebase/auth"
import { auth, provider, db } from "./firebase"
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore"

function useAuth(){
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null }
      if (!u) { setUser(null); setProfile(null); setLoading(false); return }
      setUser(u)
      const ref = doc(db, "profiles", u.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, { displayName: u.displayName || "Member", email: u.email || null, role: "member" }, { merge: true })
      }
      unsubProfile = onSnapshot(ref, (s) => { setProfile(s.exists() ? s.data() : null); setLoading(false) }, () => setLoading(false))
    })
    return () => { if (unsubProfile) unsubProfile(); unsubAuth() }
  }, [])

  return {
    user, profile, loading,
    signIn: () => signInWithPopup(auth, provider),
    signOut: () => fbSignOut(auth),
  }
}
export { useAuth }
export default useAuth
