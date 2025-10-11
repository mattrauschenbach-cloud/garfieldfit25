// src/pages/AdminStandards.jsx
import { useEffect, useMemo, useState } from 'react'
import { auth, db } from '../lib/firebase'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, updateDoc, writeBatch
} from 'firebase/firestore'

const TIERS = [
  { value: 'committed', label: 'Committed' },
  { value: 'developed', label: 'Developed' },
  { value: 'advanced',  label: 'Advanced'  },
  { value: 'elite',     label: 'Elite'     },
]

// Same fallback used on Standards + TierCheckoff
const FALLBACK = {
  committed: [
    { title: '1.5 Mile Run', detail: '13:15 or less', order: 1 },
    { title: 'Push-ups',     detail: '40 reps unbroken', order: 2 },
    { title: 'Air Squats',   detail: '75 reps unbroken', order: 3 },
  ],
  developed: [
    { title: '1.5 Mile Run', detail: '12:00 or less', order: 1 },
    { title: 'Push-ups',     detail: '60 reps unbroken', order: 2 },
    { title: 'Sit-ups',      detail: '75 reps unbroken', order: 3 },
  ],
  advanced: [
    { title: '1.5 Mile Run', detail: '10:30 or less', order: 1 },
    { title: 'Push-ups',     detail: '80 reps unbroken', order: 2 },
    { title: 'Pull-ups',     detail: '15 reps strict', order: 3 },
  ],
  elite: [
    { title: '1.5 Mile Run', detail: '9:30 or less', order: 1 },
    { title: 'Push-ups',     detail: '100 reps unbroken', order: 2 },
    { title: 'Burpees',      detail: '50 reps unbroken', order: 3 },
  ],
}

export default function AdminStandards() {
  const [me, setMe] = useState(() => auth.currentUser)
  const [role, setRole] = useState('member')
  const isMentor = role === 'mentor' || role === 'admin'

  const [tier, setTier] = useState('committed')
  const [list, setList] = useState([])     // current tier list [{id,title,detail,order,tier}]
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(null) // {id?, title, detail, order, tier}
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

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

  // live load all standards, then filter by tier
  useEffect(() => {
    setLoading(true)
    const qy = query(collection(db, 'standards'), orderBy('tier', 'asc'), orderBy('order', 'asc'))
    const unsub = onSnapshot(qy, (snap) => {
      const all = []
      snap.forEach((d) => {
        const s = d.data() || {}
        all.push({
          id: d.id,
          title: s.title || 'Untitled',
          detail: s.detail || '',
          tier: s.tier || 'committed',
          order: Number(s.order ?? 0),
        })
      })
      const current = all
        .filter(s => s.tier === tier)
        .sort((a,b)=> (a.order - b.order) || a.title.localeCompare(b.title))
      setList(current)
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [tier])

  // CRUD
  function startNew() {
    const maxOrder = list.length ? Math.max(...list.map(i => i.order ?? 0)) : -1
    setEditing({ id: null, title: '', detail: '', order: maxOrder + 1, tier })
  }
  function startEdit(item) { setEditing({ ...item }) }
  function cancelEdit() { setEditing(null) }

  async function saveEdit() {
    if (!isMentor) return alert('Mentor/admin only.')
    if (!editing?.title?.trim()) return alert('Title is required.')
    setSaving(true)
    try {
      if (editing.id) {
        await updateDoc(doc(db, 'standards', editing.id), {
          title: editing.title.trim(),
          detail: editing.detail || '',
          tier: editing.tier || tier,
          order: Number(editing.order ?? 0),
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'standards'), {
          title: editing.title.trim(),
          detail: editing.detail || '',
          tier: editing.tier || tier,
          order: Number(editing.order ?? 0),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      setEditing(null) // live listener refreshes
    } catch (e) {
      console.error(e)
      alert('Save failed. Check your Firestore rules and network.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!isMentor) return
    if (!confirm('Delete this standard?')) return
    try { await deleteDoc(doc(db, 'standards', id)) }
    catch (e) { console.error(e); alert('Delete failed (permissions?).') }
  }

  // Reorder within tier (swap 'order' values)
  async function move(id, dir) {
    if (!isMentor) return
    const idx = list.findIndex(i => i.id === id)
    if (idx < 0) return
    const j = dir === 'up' ? idx - 1 : idx + 1
    if (j < 0 || j >= list.length) return
    const a = list[idx], b = list[j]
    try {
      await runTransaction(db, async (tx) => {
        const aRef = doc(db, 'standards', a.id)
        const bRef = doc(db, 'standards', b.id)
        tx.update(aRef, { order: b.order, updatedAt: serverTimestamp() })
        tx.update(bRef, { order: a.order, updatedAt: serverTimestamp() })
      })
    } catch (e) {
      console.error(e); alert('Reorder failed.')
    }
  }

  // Move item to another tier (keeps relative order at the end)
  async function moveTier(item, toTier) {
    if (!isMentor) return
    if (item.tier === toTier) return
    try {
      // find max order in target tier
      const qy = query(collection(db, 'standards'), orderBy('tier','asc'), orderBy('order','asc'))
      const snap = await getDocs(qy)
      let max = -1
      snap.forEach(d=>{
        const s = d.data() || {}
        if ((s.tier || 'committed') === toTier) {
          const o = Number(s.order ?? 0)
          if (o > max) max = o
        }
      })
      await updateDoc(doc(db,'standards', item.id), {
        tier: toTier,
        order: max + 1,
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      console.error(e); alert('Move failed.')
    }
  }

  // —— Bulk admin helpers ——

  // Seed: add fallback (without deleting existing)
  async function seedFallback() {
    if (!isMentor) return
    const ok = confirm('Add fallback items to the collection? (Existing docs remain)')
    if (!ok) return
    setBusy(true)
    try {
      for (const t of Object.keys(FALLBACK)) {
        for (const item of FALLBACK[t]) {
          await addDoc(collection(db, 'standards'), {
            tier: t,
            title: item.title,
            detail: item.detail || '',
            order: Number(item.order ?? 0),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      }
      alert('Fallback items added ✅')
    } catch (e) {
      console.error(e); alert('Seeding failed (rules/network?).')
    } finally { setBusy(false) }
  }

  // Replace all: delete everything, then import fallback
  async function replaceWithFallback() {
    if (!isMentor) return
    const ok = confirm('⚠️ REPLACE EVERYTHING with fallback?\nThis will delete all existing standards and re-seed. This cannot be undone.')
    if (!ok) return
    setBusy(true)
    try {
      // delete all
      const snap = await getDocs(collection(db,'standards'))
      const batch = writeBatch(db)
      snap.forEach(d => batch.delete(d.ref))
      await batch.commit()
      // import fallback
      for (const t of Object.keys(FALLBACK)) {
        for (const item of FALLBACK[t]) {
          await addDoc(collection(db, 'standards'), {
            tier: t,
            title: item.title,
            detail: item.detail || '',
            order: Number(item.order ?? 0),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      }
      alert('Collection replaced with fallback ✅')
    } catch (e) {
      console.error(e); alert('Replace failed.')
    } finally { setBusy(false) }
  }

  // Normalize order numbers (0..n) inside each tier, stable by current order then title
  async function normalizeOrders() {
    if (!isMentor) return
    setBusy(true)
    try {
      const qy = query(collection(db,'standards'), orderBy('tier','asc'), orderBy('order','asc'))
      const snap = await getDocs(qy)
      const byTier = { committed:[], developed:[], advanced:[], elite:[] }
      snap.forEach(d => {
        const s = d.data() || {}
        const t = s.tier || 'committed'
        byTier[t].push({ id: d.id, title: s.title || '', order: Number(s.order ?? 0) })
      })
      const batch = writeBatch(db)
      for (const t of Object.keys(byTier)) {
        const arr = byTier[t].sort((a,b)=> (a.order - b.order) || a.title.localeCompare(b.title))
        arr.forEach((item, idx) => {
          batch.update(doc(db,'standards', item.id), { order: idx, updatedAt: serverTimestamp() })
        })
      }
      await batch.commit()
      alert('Orders normalized ✅')
    } catch (e) {
      console.error(e); alert('Normalize failed.')
    } finally { setBusy(false) }
  }

  const headerBadge = useMemo(() => TIERS.find(t=>t.value===tier)?.label || tier, [tier])

  // —— UI ——
  if (!me) {
    return (
      <section className="stack" style={{ gap: 16 }}>
        <div className="card pad">
          <div className="title">Admin: Edit Standards</div>
          <div className="sub">Sign in to manage standards.</div>
        </div>
      </section>
    )
  }
  if (!isMentor) {
    return (
      <section className="stack" style={{ gap: 16 }}>
        <div className="card pad">
          <div className="title">Access denied</div>
          <div className="sub">Mentor/admin privileges are required.</div>
        </div>
      </section>
    )
  }

  return (
    <section className="stack" style={{ gap: 16 }}>
      <header className="card pad">
        <div className="row between center">
          <div>
            <h1 className="title">Admin: Edit Standards</h1>
            <div className="sub">
              Changes here update the <strong>Standards</strong> and <strong>Tier Checkoff</strong> pages instantly (same collection).
            </div>
          </div>
          <span className="badge shift">{headerBadge}</span>
        </div>
      </header>

      {/* Controls */}
      <div className="card pad">
        <div className="grid3" style={{ gap: 12 }}>
          <div>
            <label className="label">Tier</label>
            <select className="input" value={tier} onChange={(e)=>setTier(e.target.value)}>
              {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="row center" style={{ gap: 8, alignItems:'flex-end', justifyContent:'flex-end' }}>
            <button className="btn primary" onClick={startNew}>+ New Standard</button>
          </div>
          <div className="row right" style={{ gap: 8 }}>
            <button className="btn ghost" disabled={busy} onClick={seedFallback}>Seed fallback</button>
            <button className="btn ghost" disabled={busy} onClick={normalizeOrders}>Normalize order</button>
            <button className="btn danger" disabled={busy} onClick={replaceWithFallback}>Replace with fallback</button>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card pad">
          <div className="grid3" style={{ gap: 12 }}>
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={editing.title}
                onChange={(e)=>setEditing(s=>({ ...s, title:e.target.value }))}
                placeholder="e.g., Push-ups"
              />
            </div>
            <div>
              <label className="label">Tier</label>
              <select
                className="input"
                value={editing.tier}
                onChange={(e)=>setEditing(s=>({ ...s, tier:e.target.value }))}
              >
                {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Order (within tier)</label>
              <input
                className="input"
                inputMode="numeric"
                value={editing.order}
                onChange={(e)=>setEditing(s=>({ ...s, order: Number(e.target.value || 0) }))}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="label">Detail</label>
            <textarea
              className="input"
              rows={3}
              value={editing.detail}
              onChange={(e)=>setEditing(s=>({ ...s, detail:e.target.value }))}
              placeholder="e.g., 60 reps unbroken"
            />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12, justifyContent:'flex-end' }}>
            <button className="btn ghost" onClick={cancelEdit}>Cancel</button>
            <button className="btn" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="card pad">
        <div className="row between center">
          <h2 className="title">{headerBadge} Standards</h2>
          {loading && <div className="muted">Loading…</div>}
        </div>

        {(!loading && list.length === 0) ? (
          <div className="muted" style={{ marginTop: 8 }}>No standards in this tier yet.</div>
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {list.map((s, i) => (
              <div key={s.id} className="row center" style={{
                justifyContent:'space-between', padding:'10px 12px',
                border:'1px solid #e5e7eb', borderRadius:12, gap:12
              }}>
                <div className="hstack" style={{ gap: 10 }}>
                  <span className="badge" style={{ background:'#f1f5f9', color:'#0f172a' }}>#{s.order}</span>
                  <div>
                    <div style={{ fontWeight:800 }}>{s.title}</div>
                    {s.detail && <div className="sub">{s.detail}</div>}
                  </div>
                </div>
                <div className="hstack" style={{ gap: 6 }}>
                  <select
                    className="input"
                    value={s.tier}
                    onChange={(e)=>moveTier(s, e.target.value)}
                    title="Move to another tier"
                    style={{ padding: '4px 8px' }}
                  >
                    {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button className="btn ghost" onClick={()=>move(s.id,'up')}   disabled={i===0}>↑</button>
                  <button className="btn ghost" onClick={()=>move(s.id,'down')} disabled={i===list.length-1}>↓</button>
                  <button className="btn" onClick={()=>startEdit(s)}>Edit</button>
                  <button className="btn danger" onClick={()=>remove(s.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="muted" style={{ fontSize:12 }}>
        Writes to <code>standards</code>. The **Standards** and **Tier Checkoff** pages both read this collection live.
      </div>
    </section>
  )
}
