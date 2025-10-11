// src/pages/MonthlyAdmin.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc
} from 'firebase/firestore'

function getMonthId(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function MonthlyAdmin() {
  const [monthId, setMonthId] = useState(getMonthId())
  const [meta, setMeta] = useState({ title: 'Monthly Challenge', details: '' })
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [savingMeta, setSavingMeta] = useState(false)
  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(true)

  useEffect(() => {
    setLoadingMeta(true)
    const unsub = onSnapshot(doc(db, 'meta', `monthly_${monthId}`), (snap) => {
      if (snap.exists()) {
        setMeta(snap.data()); setLoadingMeta(false)
      } else {
        getDoc(doc(db, 'meta', 'monthly')).then((m) => {
          setMeta(m.exists() ? m.data() : { title: 'Monthly Challenge', details: '' })
          setLoadingMeta(false)
        })
      }
    })
    return () => unsub()
  }, [monthId])

  useEffect(() => {
    setLoadingRows(true)
    const col = collection(db, 'monthly_history', monthId, 'entries')
    const q = query(col, orderBy('updatedAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const items = []
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }))
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
      list.sort((a, b) => (a.done !== b.done ? (a.done ? -1 : 1) : (a.name||'').localeCompare(b.name||'')))
      setRows(list); setLoadingRows(false)
    })
    return () => unsub()
  }, [monthId])

  const kpis = useMemo(() => {
    const total = rows.length
    const completed = rows.filter(r => r.done).length
    const rate = total ? Math.round((completed / total) * 100) : 0
    const shiftA = rows.filter(r => (r.shift||'A') === 'A' && r.done).length
    const shiftB = rows.filter(r => (r.shift||'A') === 'B' && r.done).length
    const shiftC = rows.filter(r => (r.shift||'A') === 'C' && r.done).length
    return { total, completed, rate, shiftA, shiftB, shiftC }
  }, [rows])

  const saveMeta = useCallback(async () => {
    setSavingMeta(true)
    try {
      await setDoc(doc(db, 'meta', `monthly_${monthId}`), {
        title: meta.title || 'Monthly Challenge',
        details: meta.details || '',
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } finally { setSavingMeta(false) }
  }, [meta, monthId])

  const saveAsTemplate = useCallback(async () => {
    setSavingMeta(true)
    try {
      await setDoc(doc(db, 'meta', 'monthly'), {
        title: meta.title || 'Monthly Challenge',
        details: meta.details || '',
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } finally { setSavingMeta(false) }
  }, [meta])

  const duplicateLastMonth = useCallback(async () => {
    const now = new Date(monthId + '-01T00:00:00Z')
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-1, 1))
    const prevId = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth()+1).padStart(2,'0')}`
    const snap = await getDoc(doc(db, 'meta', `monthly_${prevId}`))
    const data = snap.exists() ? snap.data() : null
    const payload = data || meta
    await setDoc(doc(db, 'meta', `monthly_${monthId}`), {
      title: payload.title || 'Monthly Challenge',
      details: payload.details || '',
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }, [monthId, meta])

  const exportCSV = useCallback(() => {
    const headers = ['name','shift','done','notes']
    const data = rows.map(r => [r.name, r.shift || 'A', r.done ? 'yes' : 'no', (r.notes||'').replace(/\n/g,' ').replace(/,/g,';')])
    const csv = [headers.join(','), ...data.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `monthly_${monthId}_entries.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }, [rows, monthId])

  async function toggleDone(uid, current) {
    const ref = doc(db, 'monthly_history', monthId, 'entries', uid)
    await setDoc(ref, { done: !current, updatedAt: serverTimestamp() }, { merge: true })
  }
  async function updateNotes(uid, nextNotes) {
    const ref = doc(db, 'monthly_history', monthId, 'entries', uid)
    await setDoc(ref, { notes: nextNotes || '', updatedAt: serverTimestamp() }, { merge: true })
  }
  async function removeEntry(uid) {
    await deleteDoc(doc(db, 'monthly_history', monthId, 'entries', uid))
  }

  return (
    <section className="stack" style={{ gap: 16 }}>
      <header className="card" style={{ padding: 16 }}>
        <div className="row between center">
          <div>
            <div className="eyebrow">Admin</div>
            <h1 className="title">Monthly Admin</h1>
            <div className="sub">Configure title/details and manage this month’s completions.</div>
          </div>
          <div className="row center" style={{ gap: 8 }}>
            <label className="label" style={{ margin: 0 }}>Month</label>
            <input
              className="border rounded px-3 py-2 w-40"
              value={monthId}
              onChange={e => setMonthId(e.target.value.trim())}
            />
          </div>
        </div>
      </header>

      {/* Meta editor */}
      <div className="card" style={{ padding: 16 }}>
        {loadingMeta ? (
          <div className="muted">Loading meta…</div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            <div className="grid2">
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  value={meta.title || ''}
                  onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
                  placeholder="Monthly Challenge"
                />
              </div>
              <div>
                <label className="label">Details</label>
                <input
                  className="input"
                  value={meta.details || ''}
                  onChange={e => setMeta(m => ({ ...m, details: e.target.value }))}
                  placeholder="Description shown to members"
                />
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn" disabled={savingMeta} onClick={saveMeta}>
                {savingMeta ? 'Saving…' : 'Save Month Meta'}
              </button>
              <button className="btn ghost" disabled={savingMeta} onClick={saveAsTemplate}>
                Save as Default Template
              </button>
              <button className="btn ghost" onClick={duplicateLastMonth}>
                Copy Last Month
              </button>
            </div>
          </div>
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

      {/* Table */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row between center">
          <h2 className="title">Completions</h2>
          <button className="btn ghost" onClick={exportCSV}>Export CSV</button>
        </div>

        {loadingRows ? (
          <div className="muted pad">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="muted pad">No entries for this month.</div>
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {rows.map(r => (
              <AdminRow
                key={r.uid}
                row={r}
                onToggle={() => toggleDone(r.uid, r.done)}
                onSaveNotes={(text) => updateNotes(r.uid, text)}
                onRemove={() => removeEntry(r.uid)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500" style={{ marginTop: 8 }}>
        Writes require mentor privileges per your Firestore rules.
        This page uses <code>meta/monthly_&lt;monthId&gt;</code> and <code>monthly_history/&lt;monthId&gt;/entries</code>.
      </div>
    </section>
  )
}

function AdminRow({ row, onToggle, onSaveNotes, onRemove }) {
  const [notes, setNotes] = useState(row.notes || '')
  const [saving, setSaving] = useState(false)

  const saveNotes = async () => {
    setSaving(true)
    try { await onSaveNotes(notes) } finally { setSaving(false) }
  }

  return (
    <div className="row" style={{
      justifyContent:'space-between', alignItems:'flex-start',
      gap: 12, padding:'10px', border:'1px solid #e5e7eb', borderRadius:12
    }}>
      <div style={{ minWidth: 160 }}>
        <div style={{ fontWeight:800 }}>{row.name}</div>
        <div className="sub">Shift {row.shift}</div>
      </div>

      <div className="grow">
        <label className="label">Notes</label>
        <input
          className="input"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional note"
        />
      </div>

      <div className="vstack" style={{ gap: 6, alignItems:'flex-end' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={saveNotes} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn" onClick={onToggle}>
            {row.done ? 'Mark Pending' : 'Mark Done'}
          </button>
          <button className="btn danger" onClick={onRemove}>Remove</button>
        </div>
        <div className="badge" style={{ background: row.done ? '#dcfce7' : '#fee2e2', color: row.done ? '#166534' : '#991b1b' }}>
          {row.done ? 'Done' : 'Pending'}
        </div>
      </div>
    </div>
  )
}
