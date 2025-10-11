// src/pages/MonthlyChallenge.jsx (refined)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { auth, db } from '../lib/firebase'
import {
  collection, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

/** Month id like "2025-09" */
function getMonthId(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function MonthlyChallenge() {
  const [monthId, setMonthId] = useState(getMonthId())
  const [user, setUser] = useState(null)
  const [myShift, setMyShift] = useState('A')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [meta, setMeta] = useState({ title: 'Monthly Challenge', details: '' })
  const [rows, setRows] = useState([])       // completion list for selected month
  const [loading, setLoading] = useState(true)
  const [streaks, setStreaks] = useState([]) // simple streak counter by user

  // Auth + profile shift
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u?.uid) {
        try {
          const ps = await getDoc(doc(db, 'profiles', u.uid))
          const prof = ps.exists() ? ps.data() : null
          if (prof?.shift && ['A','B','C'].includes(prof.shift)) {
            setMyShift(prof.shift)
          }
        } catch (e) {
          console.warn('Profile fetch failed', e)
        }
      }
    })
    return () => unsub()
  }, [])

  // Meta: monthly config meta/monthly_<monthId> or meta/monthly
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'meta', `monthly_${monthId}`), (snap) => {
      if (snap.exists()) setMeta(snap.data())
      else {
        getDoc(doc(db, 'meta', 'monthly')).then(m => {
          if (m.exists()) setMeta(m.data())
          else setMeta({ title: 'Monthly Challenge', details: '' })
        })
      }
    })
    return () => unsub()
  }, [monthId])

  // Completion list for this month: monthly_history/{monthId}/entries ordered by updatedAt
  useEffect(() => {
    setLoading(true)
    const col = collection(db, 'monthly_history', monthId, 'entries')
    const q = query(col, orderBy('updatedAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const items = []
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }))
      // normalize + one-per-user (last write wins for details, keep done flag)
      const byUser = new Map()
      for (const r of items) {
        const uid = r.uid || r.userId || r.id
        if (!uid) continue
        byUser.set(uid, {
          uid,
          name: r.displayName || r.name || 'Member',
          shift: r.shift || 'A',
          done: !!r.done,
          notes: r.notes || '',
          updatedAt: r.updatedAt
        })
      }
      const list = Array.from(byUser.values())
      // Board: done first then name ASC
      list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? -1 : 1
        return (a.name || '').localeCompare(b.name || '')
      })
      setRows(list)
      setLoading(false)
    })
    return () => unsub()
  }, [monthId])

  // Basic streaks: count consecutive prior months with done=true
  useEffect(() => {
    // We compute streaks for users present in current rows by checking previous months back to 12 months
    async function computeStreaks() {
      const users = rows.map(r => r.uid)
      if (!users.length) { setStreaks([]); return }
      const out = []
      const now = new Date(monthId + '-01T00:00:00Z')
      for (const uid of users) {
        let streak = 0
        for (let i = 0; i < 12; i++) {
          const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
          const mid = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`
          // read single doc for this user in that month
          const snap = await getDoc(doc(db, 'monthly_history', mid, 'entries', uid))
          const ok = snap.exists() && !!snap.data().done
          if (ok) streak += 1
          else break
        }
        out.push({ uid, streak })
      }
      setStreaks(out)
    }
    computeStreaks()
  }, [rows, monthId])

  const kpis = useMemo(() => {
    const total = rows.length
    const completed = rows.filter(r => r.done).length
    const rate = total ? Math.round((completed / total) * 100) : 0
    const shiftA = rows.filter(r => (r.shift||'A') === 'A' && r.done).length
    const shiftB = rows.filter(r => (r.shift||'A') === 'B' && r.done).length
    const shiftC = rows.filter(r => (r.shift||'A') === 'C' && r.done).length
    return { total, completed, rate, shiftA, shiftB, shiftC }
  }, [rows])

  const board = useMemo(() => {
    const withStreaks = rows.map(r => ({
      ...r,
      streak: streaks.find(s => s.uid === r.uid)?.streak || 0
    }))
    // Completed first, then streak DESC, then name ASC
    return withStreaks.sort((a,b) => {
      if (a.done !== b.done) return a.done ? -1 : 1
      if (a.streak !== b.streak) return b.streak - a.streak
      return (a.name||'').localeCompare(b.name||'')
    })
  }, [rows, streaks])

  const exportCSV = useCallback(() => {
    const headers = ['name','shift','done','streak','notes']
    const data = board.map(r => [
      r.name,
      r.shift || 'A',
      r.done ? 'yes' : 'no',
      String(r.streak || 0),
      (r.notes || '').replace(/\n/g,' ').replace(/,/g,';')
    ])
    const csv = [headers.join(','), ...data.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monthly_${monthId}_board.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [board, monthId])

  const markDone = useCallback(async () => {
    if (!user) return alert('Please sign in first.')
    setSaving(true)
    try {
      const ref = doc(db, 'monthly_history', monthId, 'entries', user.uid)
      await setDoc(ref, {
        uid: user.uid,
        displayName: user.displayName || 'Member',
        shift: myShift || 'A',
        done: true,
        notes: notes || '',
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setNotes('')
    } catch (e) {
      console.error(e)
      alert('Failed to update. Check your Firestore Security Rules and network.')
    } finally {
      setSaving(false)
    }
  }, [user, myShift, monthId, notes])

  return (
    <section className="stack" style={{ gap: 16 }}>
      <header className="card" style={{ padding: 16 }}>
        <div className="row between center">
          <div>
            <div className="eyebrow">Monthly</div>
            <h1 className="title">{meta?.title || 'Monthly Challenge'}</h1>
            {meta?.details && <p className="sub">{meta.details}</p>}
          </div>
          <div className="stack right" style={{ gap: 4 }}>
            <div className="badge shift">Month: {monthId}</div>
          </div>
        </div>
      </header>

      {/* Mark completion */}
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

          <div className="col">
            <label className="label">Notes (optional)</label>
            <input
              className="input"
              placeholder="Any quick notes about your completion"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="row" style={{ alignItems:'flex-end' }}>
            <button className="btn" disabled={saving} onClick={markDone}>
              {saving ? 'Updating…' : 'Mark Completed'}
            </button>
          </div>
        </div>

        {!user && (
          <div className="muted" style={{ marginTop: 8 }}>Sign in to mark completion.</div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid3">
        <div className="card pad">
          <div className="eyebrow">Completed</div>
          <div className="title">{kpis.completed}/{kpis.total}</div>
          <div className="sub">{kpis.rate}% participation</div>
        </div>
        <div className="card pad">
          <div className="eyebrow">By Shift</div>
          <div className="row" style={{ gap: 8, marginTop: 4, flexWrap:'wrap' }}>
            <span className="badge shift">A: {kpis.shiftA}</span>
            <span className="badge shift">B: {kpis.shiftB}</span>
            <span className="badge shift">C: {kpis.shiftC}</span>
          </div>
        </div>
        <div className="card pad">
          <div className="eyebrow">Month</div>
          <div className="title">{monthId}</div>
        </div>
      </div>

      {/* Board */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row between center">
          <h2 className="title">Completion Board</h2>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={exportCSV}>Export CSV</button>
            <div className="row center" style={{ gap: 8 }}>
              <label className="label" style={{ margin: 0 }}>View Month</label>
              <input
                className="border rounded px-3 py-2 w-40"
                value={monthId}
                onChange={e => setMonthId(e.target.value.trim())}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="muted pad">Loading…</div>
        ) : board.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {board.map((r) => (
              <Row
                key={r.uid || r.id}
                name={r.name}
                shift={r.shift || 'A'}
                notes={r.notes}
                done={r.done}
                streak={r.streak || 0}
              />
            ))}
          </div>
        )}
      </div>

      <FooterHint />
    </section>
  )
}

function Row({ name, shift, notes, done, streak }) {
  return (
    <div className="hstack" style={{
      justifyContent:'space-between', alignItems:'flex-start',
      padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:12
    }}>
      <div>
        <div style={{ fontWeight:800 }}>{name}</div>
        <div className="sub">Shift {shift} {streak ? `• ${streak} mo streak` : ''}</div>
        {notes ? <div style={{ marginTop:6, color:'#334155', fontSize:14 }}>{notes}</div> : null}
      </div>
      <div className="badge" style={{ background: done ? '#dcfce7' : '#fee2e2', color: done ? '#166534' : '#991b1b' }}>
        {done ? 'Done' : 'Pending'}
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
        <div className="sub">Mark your completion to appear on this month’s board.</div>
      </div>
    </div>
  )
}

function FooterHint() {
  return (
    <div className="text-xs text-slate-500" style={{ marginTop: 8 }}>
      This page reads from <code>monthly_history/&lt;monthId&gt;/entries</code>.
      Mentors can configure details in <code>meta/monthly_&lt;monthId&gt;</code> or fallback <code>meta/monthly</code>.
    </div>
  )
}
