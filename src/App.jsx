// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// Layout & helpers
import AppShell from "./components/AppShell"
import ProtectedRoute from "./components/ProtectedRoute"
import NotFound from "./components/NotFound"

// Pages
import Home from "./pages/Home"
import Login from "./pages/Login"
import Log from "./pages/Log"
import Members from "./pages/Members"
import MyProfile from "./pages/MyProfile"
import Standards from "./pages/Standards"
import Diag from "./pages/Diag"

export default function App(){
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/diag" element={<Diag />} />

          {/* Protected */}
          <Route
            path="/log"
            element={
              <ProtectedRoute>
                <Log />
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
            path="/me"
            element={
              <ProtectedRoute>
                <MyProfile />
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

          {/* Alias & 404 */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
