import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/firebase'
import {
  doc, getDoc, setDoc,
  collection, getDocs, query, where
} from 'firebase/firestore'
import { useAuthState } from '../lib/auth'

// Compute a simple week id like "2025-39" (ISO week)
function currentWeekId() {
  const d = new Date()
  // ISO week calc
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1))
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  const y = date.getUTCFullYear()
  const ww = String(weekNo).padStart(2,'0')
  return `${y}-${ww}`
}

const DEFAULT_WEEKLY = {
  title: 'Weekly Challenge',
  details: 'Describe this week’s challenge here.',
  targetCompletions: 25,
}

export default function WeeklyAdmin() {
  const { profile } = useAuthState()
  const isMentor = profile?.role === 'mentor'

  const [meta, setMeta] = useState(DEFAULT_WEEKLY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(0)
  const [weekId, setWeekId] = useState(currentWeekId())

  // load meta + count
  useEffect(() => {
    if (!isMentor) return
    let cancelled = false

    ;(async () => {
      try {
        setError('')
        setLoading(true)

        // Load meta/weekly
        const ms = await getDoc(doc(db, 'meta', 'weekly'))
        const cur = ms.exists() ? ms.data() : {}
        if (!cancelled) setMeta({ ...DEFAULT_WEEKLY, ...cur })

        // Count entries for this week (expects docs in weekly_logs/{weekId}/entries/*)
        const entriesCol = collection(db, 'weekly_logs', weekId, 'entries')
        const snap = await getDocs(entriesCol)
        if (!cancelled) setCount(snap.size)
      } catch (e) {
        console.error('[WeeklyAdmin] load error:', e)
        if (!cancelled) setError(e?.code || e?.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [isMentor, weekId])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        title: String(meta.title || DEFAULT_WEEKLY.title).trim(),
        details: String(meta.details || DEFAULT_WEEKLY.details).trim(),
        targetCompletions: Number(meta.targetCompletions) || 0,
        lastUpdatedAt: Date.now(),
      }
      await setDoc(doc(db, 'meta', 'weekly'), payload, { merge: true })
      alert('Weekly settings saved.')
    } catch (e) {
      console.error('[WeeklyAdmin] save error:', e)
      alert('Save failed: ' + (e?.code || e?.message || String(e)))
    } finally {
      setSaving(false)
    }
  }

  if (!isMentor) return <div className="p-4">Mentor access only.</div>
  if (loading) return <div className="p-4">Loading Weekly Admin…</div>

  return (
    <section className="space-y-4 max-w-2xl">
      <h2 className="text-2xl font-bold">Weekly Admin</h2>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-2 items-center">
          <label className="text-sm text-slate-600 md:col-span-1">Title</label>
          <input
            className="border rounded px-3 py-2 md:col-span-2"
            value={meta.title}
            onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-2">
          <label className="text-sm text-slate-600 md:col-span-1">Details</label>
          <textarea
            className="border rounded px-3 py-2 md:col-span-2 min-h-[120px]"
            value={meta.details}
            onChange={e => setMeta(m => ({ ...m, details: e.target.value }))}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-2 items-center">
          <label className="text-sm text-slate-600 md:col-span-1">Target Completions</label>
          <input
            className="border rounded px-3 py-2 w-40"
            type="number"
            min="0"
            value={meta.targetCompletions}
            onChange={e => setMeta(m => ({ ...m, targetCompletions: e.target.value }))}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-2">
        <div className="text-sm text-slate-600">Week ID</div>
        <div className="flex gap-3 items-center">
          <input
            className="border rounded px-3 py-2 w-40"
            value={weekId}
            onChange={e => setWeekId(e.target.value.trim())}
          />
          <span className="text-sm text-slate-600">Entries this week:</span>
          <span className="text-2xl font-bold">{count}</span>
        </div>
        <div className="text-xs text-slate-500">
          Your Weekly page should write logs to <code>weekly_logs/{weekId}/entries</code>.
        </div>
      </div>
    </section>
  )
}
