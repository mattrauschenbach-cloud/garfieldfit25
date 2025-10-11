import useAuth from "../lib/auth"
import { Link } from "react-router-dom"

export default function Home(){
  const { user, profile } = useAuth()
  return (
    <div className="container vstack">
      <div className="card vstack">
        <span className="badge">Home</span>
        {user ? (
          <>
            <p>Welcome, <b>{profile?.displayName || user.email}</b>.</p>
            <div className="hstack" style={{gap:8}}>
              <Link className="btn" to="/log">Go to Log</Link>
              <Link className="btn ghost" to="/diag">Diagnostics</Link>
            </div>
          </>
        ) : (
          <>
            <p>Sign in to start logging.</p>
            <Link className="btn" to="/login">Sign in</Link>
          </>
        )}
      </div>
    </div>
  )
}
