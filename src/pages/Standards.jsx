// src/pages/Standards.jsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { auth, db } from '../lib/firebase'
import {
  addDoc, collection, doc, getDoc, getDocs,
  onSnapshot, orderBy, query, serverTimestamp
} from 'firebase/firestore'

// Fallback data if Firestore is empty or blocked
const FALLBACK = {
  committed: [
    { id: 'c1', title: '1.5 Mile Run', detail: '13:15 or less', order: 1 },
    { id: 'c2', title: 'Push-ups',     detail: '40 reps unbroken', order: 2 },
    { id: 'c3', title: 'Air Squats',   detail: '75 reps unbroken', order: 3 },
  ],
  developed: [
    { id: 'd1', title: '1.5 Mile Run', detail: '12:00 or less', order: 1 },
    { id: 'd2', title: 'Push-ups',     detail: '60 reps unbroken', order: 2 },
    { id: 'd3', title: 'Sit-ups',      detail: '75 reps unbroken', order: 3 },
  ],
  advanced: [
    { id: 'a1', title: '1.5 Mile Run', detail: '10:30 or less', order: 1 },
    { id: 'a2', title: 'Push-ups',     detail: '80 reps unbroken', order: 2 },
    { id: 'a3', title: 'Pull-ups',     detail: '15 reps strict', order: 3 },
  ],
  elite: [
    { id: 'e1', title: '1.5 Mile Run', detail: '9:30 or less', order: 1 },
    { id: 'e2', title: 'Push-ups',     detail: '100 reps unbroken', order: 2 },
    { id: 'e3', title: 'Burpees',      detail: '50 reps unbroken', order: 3 },
  ],
}

const TIERS = [
  { value: 'committed', label: 'Committed' },
  { value: 'developed', label: 'Developed' },
  { value: 'advanced',  label: 'Advanced'  },
  { value: 'elite',     label: 'Elite'     },
]

function labelFor(v) {
  if (v === 'committed') return 'Committed'
  if (v === 'developed') return 'Developed'
  if (v === 'advanced')  return 'Advanced'
  if (v === 'elite')     return 'Elite'
  return v
}

export default function Standards() {
  const [me, setMe] = useState(() => auth.currentUser)
  const [role, setRole] = useState('member')
  const isMentor = role === 'mentor' || role === 'admin'

  const [tier, setTier] = useState('committed')
  const [search, setSearch] = useState('')
  const [groups, setGroups] = useState(FALLBACK)   // { committed:[], developed:[], advanced:[], elite:[] }
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // auth + role
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setMe(u)
      if (!u?.uid) { setRole('member'); return }
      try {
        const snap = await getDoc(doc(db, 'profiles', u.uid))
        setRole((snap.exists() ? snap.data()?.role : 'member') || 'member')
      } catch { setRole('member') }
    })
    return () => unsub()
  }, [])

  // live load standards; fall back if empty/blocked
  useEffect(() => {
    const col = collection(db, 'standards')
    let unsub
    setLoading(true)
    setUsingFallback(false)

    try {
      const qy = query(col, orderBy('tier', 'asc'), orderBy('order', 'asc'))
      unsub = onSnapshot(
        qy,
        (snap) => {
          const byTier = { committed: [], developed: [], advanced: [], elite: [] }
          snap.forEach((d) => {
            const s = d.data() || {}
            const t = s.tier || 'committed'
            const item = {
              id: d.id,
              title: s.title || 'Untitled Standard',
              detail: s.detail || '',
              order: Number(s.order ?? 0),
            }
            if (!byTier[t]) byTier[t] = []
            byTier[t].push(item)
          })

          // if the whole collection is empty, use fallback
          const emptyAll = Object.values(byTier).every(list => list.length === 0)
          if (emptyAll) {
            setGroups(FALLBACK)
            setUsingFallback(true)
          } else {
            // ensure per-tier sort
            Object.keys(byTier).forEach(k => {
              byTier[k].sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title))
            })
            setGroups(byTier)
            setUsingFallback(false)
          }
          setLoading(false)
        },
        async () => {
          // one-time read fallback
          try {
            const snap = await getDocs(col)
            if (snap.empty) {
              setGroups(FALLBACK)
              setUsingFallback(true)
            } else {
              const byTier = { committed: [], developed: [], advanced: [], elite: [] }
              snap.forEach((d) => {
                const s = d.data() || {}
                const t = s.tier || 'committed'
                const item = {
                  id: d.id,
                  title: s.title || 'Untitled Standard',
                  detail: s.detail || '',
                  order: Number(s.order ?? 0),
                }
                if (!byTier[t]) byTier[t] = []
                byTier[t].push(item)
              })
              Object.keys(byTier).forEach(k => {
                byTier[k].sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title))
              })
              setGroups(byTier)
              setUsingFallback(false)
            }
          } catch {
            setGroups(FALLBACK)
            setUsingFallback(true)
          } finally {
            setLoading(false)
          }
        }
      )
    } catch {
      setGroups(FALLBACK)
      setUsingFallback(true)
      setLoading(false)
    }

    return () => { if (unsub) unsub() }
  }, [])

  // Seed fallback into Firestore
  async function seedToFirestore() {
    if (!isMentor) return alert('Mentor/admin only.')
    const col = collection(db, 'standards')

    try {
      setSeeding(true)

      // if there are any docs already, confirm
      const existing = await getDocs(col)
      if (!existing.empty) {
        const ok = confirm('Standards collection is not empty. Add fallback items anyway?')
        if (!ok) { setSeeding(false); return }
      }

      // write in deterministic order
      for (const t of Object.keys(FALLBACK)) {
        for (const item of FALLBACK[t]) {
          await addDoc(col, {
            tier: t,
            title: item.title,
            detail: item.detail || '',
            order: Number(item.order ?? 0),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      }

      alert('Fallback standards imported to Firestore ✅')
      setUsingFallback(false) // live listener will refresh the list
    } catch (e) {
      console.error(e)
      alert('Import failed. Check Firestore rules and network.')
    } finally {
      setSeeding(false)
    }
  }

  const list = groups[tier] || []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.detail || '').toLowerCase().includes(q)
    )
  }, [list, search])

  const tierLabel = labelFor(tier)

  return (
    <section className="stack" style={{ gap: 16 }}>
      <header className="card pad">
        <div className="row between center">
          <div>
            <h1 className="title">Fitness Standards</h1>
            <div className="sub">
              Choose a tier to view standards separately.
              {usingFallback && (
                <span className="badge role" style={{ marginLeft: 8 }}>
                  Using fallback data
                </span>
              )}
            </div>
          </div>
          <span className="badge shift">{tierLabel}</span>
        </div>
      </header>

      {/* Filters + actions */}
      <div className="card pad">
        <div className="grid2" style={{ gap: 12 }}>
          <div>
            <label className="label">Tier</label>
            <select className="input" value={tier} onChange={(e) => setTier(e.target.value)}>
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Search (title or detail)</label>
            <input
              className="input"
              placeholder="Type to filter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Jump to Tier Checkoff with the current tier */}
        <div className="row" style={{ justifyContent:'space-between', marginTop: 12, gap: 8, flexWrap:'wrap' }}>
          <Link
            to={`/tier-checkoff?tier=${encodeURIComponent(tier)}`}
            className="btn"
            style={{ textDecoration:'none' }}
            title="Open Tier Checkoff with this tier selected"
          >
            Open Tier Checkoff →
          </Link>

          {/* Mentor-only import button when using fallback */}
          {isMentor && usingFallback && (
            <button
              className="btn primary"
              onClick={seedToFirestore}
              disabled={seeding}
              title="Create Firestore documents from the fallback list"
            >
              {seeding ? 'Importing…' : 'Import fallback to Firestore'}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="stack" style={{ gap: 12 }}>
        {loading ? (
          <div className="card pad muted">Loading standards…</div>
        ) : filtered.length === 0 ? (
          <div className="card pad muted">No standards found for this tier.</div>
        ) : (
          filtered.map((s) => (
            <div key={s.id} className="card pad">
              <div className="row between center">
                <div className="title">{s.title}</div>
                <span className="badge shift">{tierLabel}</span>
              </div>
              {s.detail && <div className="sub" style={{ marginTop: 6 }}>{s.detail}</div>}
            </div>
          ))
        )}
      </div>

      <div className="muted" style={{ fontSize: 12 }}>
        Source: <code>standards</code> (Firestore). {usingFallback ? 'Currently showing local fallback until you import.' : 'Loaded from Firestore.'}
      </div>
    </section>
  )
}
