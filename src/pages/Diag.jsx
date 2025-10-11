import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { collection, collectionGroup, getDocs, limit } from 'firebase/firestore'

export default function Diag(){
  const [info, setInfo] = useState({ env: {}, results: [] })

  useEffect(() => {
    (async () => {
      const results = []
      const env = {
        VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      }

      async function tryQuery(label, fn) {
        try {
          const snap = await fn()
          results.push({ label, ok: true, count: snap.size })
        } catch (e) {
          results.push({ label, ok: false, error: e.code || e.message })
        }
      }

      await tryQuery('profiles (collection)', () => getDocs(collection(db, 'profiles')))
      await tryQuery('weekly entries (collectionGroup)', () => getDocs(limit(collectionGroup(db, 'entries'), 1)))

      setInfo({ env, results })
    })()
  }, [])

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h1>Diag</h1>
      <pre>{JSON.stringify(info.env, null, 2)}</pre>
      <ul>
        {info.results.map((r, i) => (
          <li key={i} style={{ marginTop: 8 }}>
            <b>{r.label}:</b> {r.ok ? `OK (docs: ${r.count})` : `ERROR → ${r.error}`}
          </li>
        ))}
      </ul>
      <p style={{marginTop:12, color:'#6b7280'}}>
        If reads error with "permission-denied" even with open rules, your site is using a different Firebase project.
      </p>
    </div>
  )
}
