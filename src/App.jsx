import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AppShell from "./components/AppShell"
import ProtectedRoute from "./components/ProtectedRoute"
import NotFound from "./components/NotFound"

import Home from "./pages/Home"
import Login from "./pages/Login"
import Log from "./pages/Log"
import Diag from "./pages/Diag"

export default function App(){
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/diag" element={<Diag />} />
          <Route path="/log" element={
            <ProtectedRoute>
              <Log />
            </ProtectedRoute>
          }/>
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
