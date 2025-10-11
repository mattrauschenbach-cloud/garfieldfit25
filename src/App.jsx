// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// Layout & helpers
import AppShell from "./components/AppShell"
import ProtectedRoute from "./components/ProtectedRoute"
import MentorRoute from "./components/MentorRoute"
import NotFound from "./components/NotFound"

// Core pages
import Home from "./pages/Home"
import Login from "./pages/Login"
import Members from "./pages/Members"
import MonthlyChallenge from "./pages/MonthlyChallenge"
import MonthlyAdmin from "./pages/MonthlyAdmin"
import AdminStandards from "./pages/AdminStandards"
import Diag from "./pages/Diag"

// Optional extras (safe if missing: just remove the imports and routes)
import Ping from "./pages/Ping"
import PermTest from "./pages/PermTest"
import OwnerDashboard from "./pages/OwnerDashboard"
import OwnerMembers from "./pages/OwnerMembers"

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

          {/* Member-only */}
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
