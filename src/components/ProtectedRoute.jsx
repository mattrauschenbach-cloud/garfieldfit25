import useAuth from "../lib/auth"
import { Link } from "react-router-dom"

export default function ProtectedRoute({ children }){
  const { user, loading } = useAuth()
  if (loading) return <div className="container"><div className="card">Loading…</div></div>
  if (!user) {
    return (
      <div className="container">
        <div className="card">
          <div className="badge">Access</div>
          Please <Link to="/login">sign in</Link> to continue.
        </div>
      </div>
    )
  }
  return children
}
