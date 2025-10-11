// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AppShell from "./components/AppShell"
import ProtectedRoute from "./components/ProtectedRoute"
import MentorRoute from "./components/MentorRoute"
import NotFound from "./components/NotFound"
import { ROUTES } from "./routes"

// Pages (non-lazy to stabilize)
import Home from "./pages/Home"
import Login from "./pages/Login"
import Members from "./pages/Members"
import MonthlyChallenge from "./pages/MonthlyChallenge"
import MonthlyAdmin from "./pages/MonthlyAdmin"
import AdminStandards from "./pages/AdminStandards"
import Diag from "./pages/Diag"
import OwnerDashboard from "./pages/OwnerDashboard"
import OwnerMembers from "./pages/OwnerMembers"

// Optional extras — safe if missing: just comment out the routes if you don’t have them
// import Ping from "./pages/Ping"
// import PermTest from "./pages/PermTest"

function RouteGuard({ children }) { return <ProtectedRoute>{children}</ProtectedRoute> }
function MentorGuard({ children }) { return <MentorRoute>{children}</MentorRoute> }

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/diag" element={<Diag />} />

          {/* Member-protected */}
          <Route path="/members" element={<RouteGuard><Members /></RouteGuard>} />
          <Route path="/monthly" element={<RouteGuard><MonthlyChallenge /></RouteGuard>} />

          {/* Mentor/Admin/Owner */}
          <Route path="/monthly-admin" element={<MentorGuard><MonthlyAdmin /></MentorGuard>} />
          <Route path="/admin-standards" element={<MentorGuard><AdminStandards /></MentorGuard>} />

          {/* Owner */}
          <Route path="/owner" element={<RouteGuard><OwnerDashboard /></RouteGuard>} />
          <Route path="/owner/members" element={<RouteGuard><OwnerMembers /></RouteGuard>} />

          {/* Optional extras */}
          {/* <Route path="/ping" element={<Ping />} /> */}
          {/* <Route path="/permtest" element={<PermTest />} /> */}

          {/* Redirects */}
          <Route path="/home" element={<Navigate to="/" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
