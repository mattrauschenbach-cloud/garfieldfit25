import { useEffect, useState } from "react"
import { db } from "../lib/firebase"
import {
  collection, getCountFromServer, collectionGroup, getDocs, limit, query
} from "firebase/firestore"

const CANDIDATE_WEEKLY = ["weekly", "weeklyEntries", "weekly entries"]

export default function Diag(){
  const [env, setEnv] = useState({})
  const [profilesCount, setProfilesCount] = useState(null)
  const [weeklyInfo, setWeeklyInfo] = useState({ status: "pending" })
  const [errors, setErrors] = useState([])

  useEffect(() => {
    setEnv({
      VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    })
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const c = await getCountFromServer(collection(db, "profiles"))
        setProfilesCount(c.data().count)
      } catch (e) {
        setErrors(x => [...x, `profiles: ${e.code || e.message}`])
      }

      // try candidate subcollection names, one by one
      for (const name of CANDIDATE_WEEKLY) {
        try {
          // quick probe without filters (avoids composite index issues)
          const q = query(collectionGroup(db, name), limit(1))
          const snap = await getDocs(q)
          setWeeklyInfo({
            status: "ok",
            foundName: name,
            sampleCount: snap.size
          })
          return
        } catch (e) {
          if (e?.code === "permission-denied") {
            setWeeklyInfo({ status: "error", error: "permission-denied", note: "Check Firestore rules & Authorized domains." })
            return
          }
          // keep trying the next candidate; record error for debugging
          setWeeklyInfo(w => (w.status === "pending" ? { status: "trying", lastError: e.message } : w))
        }
      }
      setWeeklyInfo({ status: "error", error: "not-found", note: "No weekly* subcollection detected. Pick 'weekly' for consistency (no spaces)." })
    })()
  }, [])

  return (
    <div className="container vstack">
      <div className="card">
        <div className="badge">Env</div>
        <pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(env, null, 2)}</pre>
        {env.VITE_FIREBASE_STORAGE_BUCKET?.endsWith(".appspot.com") ? null : (
          <p style={{color:"#fca5a5"}}>⚠️ storageBucket should end with <b>.appspot.com</b></p>
        )}
      </div>

      <div className="card">
        <div className="badge">profiles (collection)</div>
        <p>{profilesCount === null ? "Loading…" : `OK (docs: ${profilesCount})`}</p>
      </div>

      <div className="card">
        <div className="badge">weekly (collectionGroup)</div>
        {weeklyInfo.status === "ok" && (
          <p>OK — detected subcollection name: <b>{weeklyInfo.foundName}</b> (sample: {weeklyInfo.sampleCount})</p>
        )}
        {weeklyInfo.status !== "ok" && (
          <p style={{color:"#fca5a5"}}>
            {weeklyInfo.error === "permission-denied"
              ? "ERROR → permission-denied (check rules & authorized domains)."
              : "ERROR → no subcollection found named weekly/weeklyEntries/\"weekly entries\"."}
            {" "}
            {weeklyInfo.note}
          </p>
        )}
        <p style={{color:"#9ca3af", marginTop:8}}>
          Recommended structure: <code>profiles/{'{uid}'}/weekly/{'{weekId}'}</code> (no spaces).
        </p>
      </div>

      {errors.length > 0 && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          <div className="badge">Diag warnings</div>
          <pre style={{whiteSpace:"pre-wrap"}}>{errors.join("\n")}</pre>
        </div>
      )}
    </div>
  )
}
