// src/lib/auth.jsx
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'

// Ensure a profile doc exists and has required fields
async function ensureProfile(u) {
  if (!u) return null
  const ref = doc(db, 'profiles', u.uid)
  const snap = await getDoc(ref)

  const base = {
    displayName: u.displayName || 'Firefighter',
    email: u.email || null,
    role: 'member',
  }

  if (!snap.exists()) {
    await setDoc(ref, base, { merge: true })
    return base
  }

  const data = snap.data() || {}
  const next = { ...base, ...data }
  if (!data.displayName || !data.role) {
    await setDoc(ref, next, { merge: true })
  }
  return next
}

function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // clear any previous profile subscription
      if (unsubProfile) {
        unsubProfile()
        unsubProfile = null
      }

      if (!u) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(u)
      // make sure a profile exists and has basics
      await ensureProfile(u)

      const ref = doc(db, 'profiles', u.uid)
      unsubProfile = onSnapshot(
        ref,
        (snap) => {
          setProfile(snap.exists() ? snap.data() : null)
          setLoading(false)
        },
        () => setLoading(false)
      )
    })

    return () => {
      if (unsubProfile) unsubProfile()
      unsubAuth()
    }
  }, [])

  return {
    user,
    profile,
    loading,
    signOut: () => fbSignOut(auth),
  }
}

export { useAuth }
export default useAuth
