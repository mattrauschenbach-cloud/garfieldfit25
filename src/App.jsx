// src/App.jsx
import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import AppShell from "./components/AppShell"
import ProtectedRoute from "./components/ProtectedRoute"
import MentorRoute from "./components/MentorRoute"
import NotFound from "./components/NotFound"

// Lazy-loaded pages
const Home = lazy(() => import("./pages/Home"))
const Login = lazy(() => import("./pages/Login"))
const Members = lazy(() => import("./pages/Members"))
const MonthlyChallenge = lazy(() => import("./pages/MonthlyChallenge"))
const MonthlyAdmin = lazy(() => import("./pages/MonthlyAdmin"))
const AdminStandards = lazy(() => import("./pages/AdminStandards"))
const Diag = lazy(() => import("./pages/Diag"))

// Owner (optional but recommended)
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"))
const OwnerMembers = lazy(() => import("./pages/OwnerMembers"))

// Optional extra demo/debug pages if they exist in your repo
const Ping = lazy(() => import("./pages/Ping").catch(() => ({ default: () => null })))
const PermTest = lazy(() => import("./pages/PermTest").catch(() => ({ default: () => null })))

function Loader() {
  return (
    <div className="container">
      <div className="card">Loading…</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/diag" element={<Diag />} />

            {/* Member-protected */}
            <Route
              path="/members"
              element={
                <ProtectedRoute>
                  <Members />
                </ProtectedRoute>
              }
            />

            <Route
              path="/monthly"
              element={
                <ProtectedRoute>
                  <MonthlyChallenge />
                </ProtectedRoute>
              }
            />

            {/* Mentor/Admin/Owner */}
            <Route
              path="/monthly-admin"
              element={
                <MentorRoute>
                  <MonthlyAdmin />
                </MentorRoute>
              }
            />
            <Route
              path="/admin-standards"
              element={
                <MentorRoute>
                  <AdminStandards />
                </MentorRoute>
              }
            />

            {/* Owner */}
            <Route
              path="/owner"
              element={
                <ProtectedRoute>
                  <OwnerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/owner/members"
              element={
                <ProtectedRoute>
                  <OwnerMembers />
                </ProtectedRoute>
              }
            />

            {/* Optional extras (safe to leave; render nothing if not present) */}
            <Route path="/ping" element={<Ping />} />
            <Route path="/permtest" element={<PermTest />} />

            {/* Redirects */}
            <Route path="/home" element={<Navigate to="/" replace />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  )
}
