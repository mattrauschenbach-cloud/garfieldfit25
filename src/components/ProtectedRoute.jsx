import { useAuth } from '../lib/auth'
import AccessDenied from './AccessDenied'

export default function ProtectedRoute({ children }){
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="container">
        <div className="card">Checking your session…</div>
      </div>
    )
  }
  if (!user) {
    return <AccessDenied reason="Please sign in to continue." />
  }
  return children
}
