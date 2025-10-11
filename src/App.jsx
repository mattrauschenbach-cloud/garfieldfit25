// src/App.jsx
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import NotFound from './components/NotFound'
import AppShell from './components/AppShell'

// PAGES
const WeeklyChallenge  = lazy(() => import('./pages/WeeklyChallenge.jsx'))
const MonthlyChallenge = lazy(() => import('./pages/MonthlyChallenge.jsx'))
const Members          = lazy(() => import('./pages/Members.jsx'))
const Standards        = lazy(() => import('./pages/Standards.jsx'))
const TierCheckoff     = lazy(() => import('./pages/TierCheckoff.jsx'))
const AdminStandards   = lazy(() => import('./pages/AdminStandards.jsx'))
const Login            = lazy(() => import('./pages/Login.jsx'))

// Simple guards (replace with your own if you already have them)
import { auth, db } from './lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(() => auth.currentUser)
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser)
    return () => unsub()
  }, [])
  if (user === undefined) return null
  return user ? children : <Navigate to="/login" replace />
}

function MentorRoute({ children }) {
  const [user, setUser] = useState(() => auth.currentUser)
  const [ok, setOk] = useState(null)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u)
      if (!u) { setOk(false); return }
      try {
        const snap = await getDoc(doc(db, 'profiles', u.uid))
        const role = snap.exists() ? (snap.data().role || 'member') : 'member'
        setOk(role === 'mentor' || role === 'admin')
      } catch {
        setOk(false)
      }
    })
    return () => unsub()
  }, [])

  if (!user) return <Navigate to="/login" replace />
  if (ok === null) return null
  return ok ? children : <div className="card pad"><div className="title">Access denied</div><div className="sub">Mentor/admin only.</div></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={<div className="card pad">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/weekly" replace />} />

            <Route path="/weekly" element={<WeeklyChallenge />} />
            <Route path="/monthly" element={<MonthlyChallenge />} />
            <Route path="/members" element={<Members />} />
            <Route path="/standards" element={<Standards />} />

            {/* Tier checkoff: mentor/admin only */}
            <Route
              path="/tier-checkoff"
              element={
                <ProtectedRoute>
                  <MentorRoute>
                    <TierCheckoff />
                  </MentorRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin standards: mentor/admin only */}
            <Route
              path="/admin-standards"
              element={
                <ProtectedRoute>
                  <MentorRoute>
                    <AdminStandards />
                  </MentorRoute>
                </ProtectedRoute>
              }
            />

            <Route path="/login" element={<Login />} />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/weekly" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  )
}
