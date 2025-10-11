import { useEffect, useState } from "react"
import useAuth from "../lib/auth"
import { db } from "../lib/firebase"
import { collection, getCountFromServer } from "firebase/firestore"
import AccessDenied from "../components/AccessDenied"

export default function OwnerDashboard(){
  const { user, profile, loading } = useAuth()
  const [stats, setStats] = useState({ members:0, monthlyDocs:0 })

  if (loading) return <div className="container"><div className="card">Loading…</div></div>
  if (!user || profile?.role !== "owner") return <AccessDenied reason="Owner access required." />

  useEffect(() => {
    (async () => {
      const m = await getCountFromServer(collection(db,"profiles"))
      const mo = await getCountFromServer(collection(db,"monthly"))
      setStats({ members: m.data().count, monthlyDocs: mo.data().count })
    })()
  },[])

  return (
    <div className="container grid grid-2">
      <div className="card vstack">
        <span className="badge">Overview</span>
        <div className="hstack" style={{gap:16}}>
          <div className="vstack"><b>{stats.members}</b><span className="badge">Profiles</span></div>
          <div className="vstack"><b>{stats.monthlyDocs}</b><span className="badge">Monthly docs</span></div>
        </div>
      </div>
      <div className="card vstack">
        <span className="badge">Shortcuts</span>
        <a className="btn" href="/owner/members">Manage roles</a>
        <a className="btn ghost" href="/monthly-admin">Monthly admin</a>
      </div>
    </div>
  )
}
