import { useEffect, useState } from "react"
import { db } from "../lib/firebase"
import { collection, getCountFromServer } from "firebase/firestore"

export default function Diag(){
  const [env, setEnv] = useState({})
  const [profiles, setProfiles] = useState(null)
  useEffect(() => {
    setEnv({
      VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    })
    ;(async () => {
      const c = await getCountFromServer(collection(db, "profiles"))
      setProfiles(c.data().count)
    })()
  }, [])
  return (
    <div className="container vstack">
      <div className="card"><div className="badge">Env</div><pre>{JSON.stringify(env,null,2)}</pre></div>
      <div className="card"><div className="badge">profiles</div><p>{profiles===null?"…":`OK (docs: ${profiles})`}</p></div>
    </div>
  )
}
