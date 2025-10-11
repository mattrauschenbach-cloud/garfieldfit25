import { useAuth } from '../lib/auth'
import AccessDenied from './AccessDenied'

export default function MentorRoute({ children }){
  const { user, profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="container">
        <div className="card">Checking your permissions…</div>
      </div>
    )
  }
  if (!user) return <AccessDenied reason="Please sign in to continue." />
  const role = profile?.role || 'member'
  if (role !== 'mentor' && role !== 'admin' && role !== 'owner') {
    return <AccessDenied reason="Mentor or Admin access required." />
  }
  return children
}
