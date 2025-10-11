// src/lib/auth.jsx
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'

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
  // merge any missing fields
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
    // watch auth
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        setLoading(false)
        return
      }

      await ensureProfile(u)

      // watch profile doc
      const ref = doc(db, 'profiles', u.uid)
      const unsubProfile = onSnapshot(ref, (snap) => {
        setProfile(snap.exists() ? snap.data() : null)
        setLoading(false)
      }, () => setLoading(false))

      // cleanup nested sub
      return () => unsubProfile()
    })

    return (
