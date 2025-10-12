// src/App.jsx
import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import useAuth from "./lib/auth"
import NavBar from "./components/NavBar"

// Lazy-load pages (these files should exist in src/pages/)
const Members    = lazy(() => import("./pages/Members"))
const Standards  = lazy(() => import("./pages/Standards"))
const Checkoffs  = lazy(() => import("./pages/Checkoffs"))
const Weekly     = lazy(() => import("./pages/Weekly"))
const MyProfile  = lazy(() => import("./pages/MyProfile"))
const Login      = lazy(() => import("./pages/Login"))

// Minimal loading UI
function Loading() {
  return (
    <div className="container card" style={{marginTop:16}}>
      <span className="badge">Loading…</span>
    </div>
  )
}

// Require the user to be signed in
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Redirect to app if already signed in (for /login)
function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/members" replace />
  return children
}

// 404 fallback
function NotFound() {
  return (
    <div className="container card vstack" style={{marginTop:16}}>
      <span className="badge">Not Found</span>
      <p style={{color:"#cbd5e1"}}>The page you’re looking for doesn’t exist.</p>
      <a className="btn" href="/members">Go to Members</a>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Root → members (you can change this to /weekly if you prefer) */}
          <Route path="/" element={<Navigate to="/members" replace />} />

          {/* Public */}
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />

          {/* Signed-in only */}
          <Route
            path="/members"
            element={
              <RequireAuth>
                <Members />
              </RequireAuth>
            }
          />
          <Route
            path="/standards"
            element={
              <RequireAuth>
                <Standards />
              </RequireAuth>
            }
          />
          <Route
            path="/checkoffs"
            element={
              <RequireAuth>
                <Checkoffs />
              </RequireAuth>
            }
          />
          <Route
            path="/weekly"
            element={
              <RequireAuth>
                <Weekly />
              </RequireAuth>
            }
          />
          <Route
            path="/my"
            element={
              <RequireAuth>
                <MyProfile />
              </RequireAuth>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
