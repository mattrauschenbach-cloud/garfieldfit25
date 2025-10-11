// src/lib/auth.js
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'

async function ensureProfile(u) {
  const ref = doc(db, 'profiles', u.uid)
  const snap = await getDoc(ref)

  const base = {
    displayName: u.displayName || 'Firefighter',
    email: u.email || null,
  }

  if (!snap.exists()) {
    // First login → create with defaults (role=member only once)
    await setDoc(
      ref,
      { ...base, shift: 'A', tier: 'committed', role: 'member' },
      { merge: true }
    )
  } else {
    // Already exists → DO NOT touch role/tier/shift unless missing
    const cur = snap.data() || {}
    await setDoc(
      ref,
      {
        ...base,
        shift: cur.shift || 'A',
        tier: cur.tier || 'committed',
        // leave role exactly as-is
      },
      { merge: true }
    )
  }
}

export function useAuthState() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u)

        if (unsubProfile) {
          unsubProfile()
          unsubProfile = null
        }

        if (u) {
          await ensureProfile(u) // ← only creates/merges without changing role

          const ref = doc(db, 'profiles', u.uid)
          unsubProfile = onSnapshot(
            ref,
            (snap) => setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null),
            () => setProfile(null)
          )
        } else {
          setProfile(null)
        }
      } finally {
        setLoading(false)
      }
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
