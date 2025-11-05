import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"

import NavBar from "./components/NavBar"
import EntryGate from "./components/EntryGate"
import ProtectedRoute from "./components/ProtectedRoute"
import ErrorBoundary from "./components/ErrorBoundary"

// --- Lazy-loaded pages ---
const Home = lazy(() => import("./pages/Home"))
const Members = lazy(() => import("./pages/Members"))
const Standards = lazy(() => import("./pages/Standards"))
const Checkoffs = lazy(() => import("./pages/Checkoffs"))
const Weekly = lazy(() => import("./pages/Weekly"))
const Leaderboard = lazy(() => import("./pages/Leaderboard"))
const AllTimeLeaders = lazy(() => import("./pages/AllTimeLeaders")) // ✅ NEW
const MyProfile = lazy(() => import("./pages/MyProfile"))
const Login = lazy(() => import("./pages/Login"))
const Status = lazy(() => import("./pages/Status"))

// --- Loading fallback ---
function Loading() {
  return (
    <div className="container vstack" style={{ gap: 10 }}>
      <div className="card" style={{ color: "#cbd5e1" }}>Loading…</div>
    </div>
  )
}

// --- Scroll reset on route change ---
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// --- 404 Page ---
function NotFound() {
  return (
    <div className="container vstack" style={{ gap: 12 }}>
      <div className="card vstack" style={{ gap: 6 }}>
        <span className="badge">404</span>
        <h2 style={{ margin: 0 }}>Page not found</h2>
        <p style={{ color: "#9ca3af" }}>
          The page you’re looking for doesn’t exist. Head back to{" "}
          <a className="link" href="/">Home</a>.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <NavBar />

      {/* EntryGate shows on first load / every 24 h */}
      <EntryGate />

      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* --- Public routes --- */}
            <Route path="/login" element={<Login />} />
            <Route path="/status" element={<Status />} />

            {/* --- Protected routes --- */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedRoute>
                  <Members />
                </ProtectedRoute>
              }
            />
            <Route
              path="/standards"
              element={
                <ProtectedRoute>
                  <Standards />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkoffs"
              element={
                <ProtectedRoute>
                  <Checkoffs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/weekly"
              element={
                <ProtectedRoute>
                  <Weekly />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
            {/* ✅ NEW All-Time Leaders route */}
            <Route
              path="/all-time-leaders"
              element={
                <ProtectedRoute>
                  <AllTimeLeaders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my"
              element={
                <ProtectedRoute>
                  <MyProfile />
                </ProtectedRoute>
              }
            />

            {/* --- Back-compat redirect --- */}
            <Route path="/home" element={<Navigate to="/" replace />} />

            {/* --- Catch-all 404 --- */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
