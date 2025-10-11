// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// layout + route helpers
import AppShell from "./components/AppShell"
import ProtectedRoute from "./components/ProtectedRoute"
import MentorRoute from "./components/MentorRoute"
import NotFound from "./components/NotFound"

// pages (make sure file names/casing match exactly)
import Home from "./pages/Home"
import Login from "./pages/Login"
import Members from "./pages/Members"
import MonthlyChallenge from "./pages/MonthlyChallenge"
import MonthlyAdmin from "./pages/MonthlyAdmin"
import AdminStandards from "./pages/AdminStandards"
import Diag from "./pages/Diag"
import Ping from "./pages/Ping"
import PermTest from "./pages/PermTest"

// Owner pages (comment these two lines + the routes below if you haven't added them yet)
import OwnerDashboard from "./pages/OwnerDashboard"
import OwnerMembers from "./pages/OwnerMembers"

// Optional: quick loader component used in a few places
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
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/diag" element={<Diag />} />
          <Route path="/ping" element={<Ping />} />
          <Route path="/permtest" element={<PermTest />} />

          {/* Member-only pages */}
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

          {/* Alias & 404 */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
