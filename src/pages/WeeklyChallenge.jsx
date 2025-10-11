// src/pages/WeeklyChallenge.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { auth, db } from '../lib/firebase'
import {
  addDoc, collection, deleteDoc, doc, getDoc,
  onSnapshot, orderBy, query, serverTimestamp
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

/** Week id like "2025-W39" */
function getWeekId(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function fmt(ts) {
  // Handles Firestore Timestamp, Date, or missing
  try {
    if (!ts) return ''
    const dt = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts))
    return dt.toLocaleString()
  } catch {
    return ''
  }
}

export default function WeeklyChallenge() {
  const [weekId, setWeekId] = useState(getWeekId())
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('member')
  const isMentor = role === 'mentor' || role === 'admin'

  const [myShift, setMyShift] = useState('A')
  const [myValue, setMyValue] = useState('')
  const [saving, setSaving] = useState(false)

  const [meta, setMeta] = useState({ title: 'Weekly Challenge', details: '', target: null })

  // Leaderboard (coalesced per user) + recent raw logs
  const [entries, setEntries] = useState([])   // [{uid,name,shift,total,logs}]
  const [recent, setRecent] = useState([])     // last 25 raw logs
  const [loading, setLoading] = useState(true)

  // Auth + profile (for shift default + role)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u?.uid) { setRole('member'); return }
      try {
        const ps = await getDoc(doc(db, 'profiles', u.uid))
        const prof = ps.exists() ? ps.data() : null
        if (prof?.shift && ['A','B','C'].includes(prof.shift)) setMyShift(prof.shift)
        setRole(prof?.role || 'member')
      } catch {
        setRole('member')
      }
    })
    return () => unsub()
  }, [])

  // Meta (weekly_<id> or fallback weekly)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'meta', `weekly_${weekId}`), (snap) => {
      if (snap.exists()) {
        setMeta(snap.data())
      } else {
        getDoc(doc(db, 'meta', 'weekly')).then((m) => {
          if (m.exists()) setMeta(m.data())
          else setMeta({ title: 'Weekly Challenge', details: '', target: null })
        })
      }
    })
    return () => unsub()
  }, [weekId])

  // READ logs: multiple docs per user allowed; sum for leaderboard + keep recent
  useEffect(() => {
    setLoading(true)
    const col = collection(db, 'weekly_logs', weekId, 'entries')
    const q = query(col, orderBy('updatedAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const raw = []
      snap.forEach((d) => raw.push({ id: d.id, ...d.data() }))

      // Recent list (last 25 items as-is)
      const latest = raw.slice(0, 25)

      // Coalesce sums per user for leaderboard
      const byUser = new Map()
      for (const r of raw) {
        const uid = r.uid || r.userId || r.id
        if (!uid) continue
        const inc = Number(r.value ?? r.amount ?? 0)
        const name = r.displayName || r.name || 'Member'
        const shift = r.shift || 'A'
        if (!byUser.has(uid)) byUser.set(uid, { uid, name, shift, total: 0, logs: 0 })
        const cur = byUser.get(uid)
        cur.total += Number.isFinite(inc) ? inc : 0
        cur.logs += 1
      }
      const list = Array.from(byUser.values())
      list.sort((a, b) => (b.total || 0) - (a.total || 0))

      setEntries(list)
      setRecent(latest)
      setLoading(false)
    })
    return () => unsub()
  }, [weekId])

  // KPIs
  const kpis = useMemo(() => {
    const participants = entries.length
    const shiftA = entries.filter(e => (e.shift || 'A') === 'A').reduce((s, r) => s + (r.total || 0), 0)
    const shiftB = entries.filter(e => (e.shift || 'A') === 'B').reduce((s, r) => s + (r.total || 0), 0)
    const shiftC = entries.filter(e => (e.shift || 'A') === 'C').reduce((s, r) => s + (r.total || 0), 0)
    const grand = shiftA + shiftB + shiftC
    const logs = entries.reduce((n, r) => n + (r.logs || 0), 0)
    return { participants, shiftA, shiftB, shiftC, grand, logs }
  }, [entries])

  const leaders = useMemo(() => entries.slice(0, 10), [entries])

  // WRITE: add a new log (auto-ID)
  const addLog = useCallback(async () => {
    if (!user) return alert('Please sign in first.')
    const val = Number(myValue)
    if (!Number.isFinite(val) || val <= 0) return alert('Enter a positive number.')

    setSaving(true)
    try {
      await addDoc(collection(db, 'weekly_logs', weekId, 'entries'), {
        uid: user.uid,
        displayName: user.displayName || 'Member',
        shift: myShift || 'A',
        value: val,
        updatedAt: serverTimestamp(),
      })
      setMyValue('')
    } catch (e) {
      console.error(e)
      alert('Failed to save. Check your Firestore Security Rules and network.')
    } finally {
      setSaving(false)
    }
  }, [user, myValue, myShift, weekId])

  // Mentor-only delete a single log
  const deleteLog = useCallback(async (logId) => {
    if (!isMentor) return
    if (!confirm('Delete this log entry?')) return
    try {
      await deleteDoc(doc(db, 'weekly_logs', weekId, 'entries', logId))
    } catch (e) {
      console.error(e)
      alert('Delete failed. Check permissions (mentor-only) and network.')
    }
  }, [isMentor, weekId])

  return (
    <section className="stack" style={{ gap: 16 }}>
      <header className="card" style={{ padding: 16 }}>
        <div className="row between center">
          <div>
            <div className="eyebrow">Weekly</div>
            <h1 className="title">{meta?.title || 'Weekly Challenge'}</h1>
            {meta?.details && <p className="sub">{meta.details}</p>}
          </div>
          <div className="stack right" style={{ gap: 4 }}>
            <div className="badge shift">Week: {weekId}</div>
            {meta?.target != null && (
              <div className="badge" style={{ background:'#dcfce7', color:'#166534' }}>
                Goal: {meta.target}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Input */}
      <div className="card" style={{ padding: 16 }}>
        <div className="grid3" style={{ gap: 12 }}>
          <div>
            <label className="label">My Shift</label>
            <select className="input" value={myShift} onChange={e => setMyShift(e.target.value)}>
              <option value="A">A Shift</option>
              <option value="B">B Shift</option>
              <option value="C">C Shift</option>
            </select>
          </div>

          <div>
            <label className="label">Add to My Total</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="Enter number"
              value={myValue}
              onChange={e => setMyValue(e.target.value)}
            />
          </div>

          <div className="row" style={{ alignItems:'flex-end' }}>
            <button className="btn" disabled={saving} onClick={addLog}>
              {saving ? 'Saving…' : 'Add Log'}
            </button>
          </div>
        </div>
        {!user && <div className="muted" style={{ marginTop: 8 }}>Sign in to submit your weekly logs.</div>}
      </div>

      {/* KPIs */}
      <div className="grid3">
        <div className="card pad">
          <div className="eyebrow">Total Logged</div>
          <div className="title">{kpis.grand}</div>
          <div className="sub">{kpis.logs} logs this week</div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Shift Totals</div>
          <div className="row" style={{ gap: 8, marginTop: 4, flexWrap:'wrap' }}>
            <span className="badge shift">A: {kpis.shiftA}</span>
            <span className="badge shift">B: {kpis.shiftB}</span>
            <span className="badge shift">C: {kpis.shiftC}</span>
          </div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Participants</div>
          <div className="title">{kpis.participants}</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row between center">
          <h2 className="title">Weekly Leaderboard</h2>
          <div className="row" style={{ gap: 8 }}>
            <div className="row center" style={{ gap: 8 }}>
              <label className="label" style={{ margin: 0 }}>View Week</label>
              <input
                className="border rounded px-3 py-2 w-40"
                value={weekId}
                onChange={e => setWeekId(e.target.value.trim())}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="muted pad">Loading…</div>
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {leaders.map((r, i) => (
              <Row
                key={r.uid}
                rank={i + 1}
                name={r.name}
                shift={r.shift || 'A'}
                value={r.total ?? 0}
                logs={r.logs || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Logs (last 25) */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row between center">
          <h2 className="title">Recent Logs</h2>
          <div className="sub">{recent.length} shown • newest first</div>
        </div>

        {loading ? (
          <div className="muted pad">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="muted pad">No logs yet this week.</div>
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {recent.map((r) => (
              <RecentRow
                key={r.id}
                log={r}
                canDelete={isMentor}
                onDelete={() => deleteLog(r.id)}
              />
            ))}
          </div>
        )}
      </div>

      <FooterHint />
    </section>
  )
}

function Row({ rank, name, shift, value, logs }) {
  return (
    <div className="row center" style={{
      justifyContent:'space-between', padding:'8px 10px',
      border:'1px solid #e5e7eb', borderRadius:12
    }}>
      <div className="hstack" style={{ gap:10 }}>
        <div className="badge" style={{ background:'#f1f5f9', color:'#0f172a' }}>#{rank}</div>
        <div>
          <div style={{ fontWeight:800 }}>{name}</div>
          <div className="sub">Shift {shift} • {logs} log{logs===1?'':'s'}</div>
        </div>
      </div>
      <div className="title">{value}</div>
    </div>
  )
}

function RecentRow({ log, canDelete, onDelete }) {
  const name = log.displayName || log.name || 'Member'
  const shift = log.shift || 'A'
  const val = Number(log.value ?? log.amount ?? 0)
  const when = fmt(log.updatedAt)

  return (
    <div className="row center" style={{
      justifyContent:'space-between', padding:'10px 12px',
      border:'1px solid #e5e7eb', borderRadius:12, gap:12
    }}>
      <div className="hstack" style={{ gap:10 }}>
        <div style={{ fontWeight:800 }}>{name}</div>
        <div className="badge shift">Shift {shift}</div>
        <div className="muted">{when}</div>
      </div>
      <div className="hstack" style={{ gap:10 }}>
        <div className="title">{val}</div>
        {canDelete && (
          <button className="btn danger" onClick={onDelete}>Delete</button>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="pad" style={{
      border:'1px dashed #e5e7eb', borderRadius:12, marginTop: 12
    }}>
      <div className="stack center" style={{ gap:6, textAlign:'center' }}>
        <div className="title" style={{ fontSize:18 }}>No entries yet</div>
        <div className="sub">Add a log to start the board for this week.</div>
      </div>
    </div>
  )
}

function FooterHint() {
  return (
    <div className="text-xs text-slate-500" style={{ marginTop: 8 }}>
      Logs are stored in <code>weekly_logs/&lt;weekId&gt;/entries</code> as individual docs.
      Leaderboard sums logs per user. Only mentors can delete specific logs in <i>Recent Logs</i>.
    </div>
  )
}
