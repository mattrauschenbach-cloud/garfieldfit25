// src/pages/MonthlyChallenge.jsx
import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, orderBy, query } from "firebase/firestore"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import AddWeeklyEntry from "../components/AddWeeklyEntry"

function parseDateIdOrTS(id, createdAt) {
  // Prefer the doc id if it looks like YYYY-MM-DD, else createdAt
  if (typeof id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const d = new Date(id + "T00:00:00")
    if (!isNaN(d)) return d
  }
  if (createdAt?.toDate) {
    try { return createdAt.toDate() } catch {}
  }
  return null
}

function monthKey(d) {
  // "2025-10"
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export default function MonthlyChallenge() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setErr(null)
    const q = query(
      collection(db, "profiles", user.uid, "weekly"),
      orderBy("createdAt", "desc")
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setRows(list)
        setLoading(false)
      },
      (e) => {
        setErr(e)
        setLoading(false)
      }
    )
    return unsub
  }, [user])

  const now = new Date()
  const thisMonthKey = monthKey(now)

  // Normalize entries with dates
  const normalized = useMemo(() => {
    return rows.map((r) => {
      const d = parseDateIdOrTS(r.id, r.createdAt)
      return {
        ...r,
        _date: d,
        _month: d ? monthKey(d) : null,
        _score: Number(r.score) || 0,
      }
    })
  }, [rows])

  // Totals
  const totals = useMemo(() => {
    const monthTotals = new Map() // monthKey -> total score
    let overall = 0
    let thisMonth = 0
    normalized.forEach((r) => {
      overall += r._score
      if (r._month) {
        monthTotals.set(r._month, (monthTotals.get(r._month) || 0) + r._score)
        if (r._month === thisMonthKey) thisMonth += r._score
      }
    })
    // Build last 6 months series (descending by month)
    const keys = Array.from(monthTotals.keys()).sort().slice(-6)
    const last6 = keys.map((k) => ({ month: k, total: monthTotals.get(k) }))
    return { overall, thisMonth, last6 }
  }, [normalized, thisMonthKey])

  return (
    <div className="container vstack">
      <div className="card vstack">
        <div className="hstack" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="badge">Monthly Challenge</span>
            <span className="badge">This month: <b>{totals.thisMonth}</b></span>
            <span className="badge">Overall: <b>{totals.overall}</b></span>
          </div>
          <div className="hstack" style={{ gap: 8 }}>
            <AddWeeklyEntry />
          </div>
        </div>
        <p style={{ color: "#9ca3af", margin: 0 }}>
          Tip: each entry uses today’s date as the key (YYYY-MM-DD). You can add one entry per day.
        </p>
      </div>

      <div className="card vstack">
        <span className="badge">Last 6 months</span>
        {totals.last6.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>No history yet.</p>
        ) : (
          <ul className="vstack" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {totals.last6.map((m) => (
              <li
                key={m.month}
                className="hstack"
                style={{ justifyContent: "space-between", borderBottom: "1px solid #1f2937", padding: "8px 0" }}
              >
                <span>{m.month}</span>
                <b>{m.total}</b>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card vstack">
        <span className="badge">Your recent entries</span>
        {loading ? (
          <p>Loading…</p>
        ) : err ? (
          <p style={{ color: "#fca5a5" }}>Error: {String(err.message || err)}</p>
        ) : normalized.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>No entries yet — add your first one above.</p>
        ) : (
          <ul className="vstack" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {normalized.map((r) => (
              <li
                key={r.id}
                className="hstack"
                style={{ justifyContent: "space-between", borderBottom: "1px solid #1f2937", padding: "8px 0" }}
              >
                <div className="hstack" style={{ gap: 10 }}>
                  <span className="badge">Day</span>
                  <span>{r._date ? r._date.toISOString().slice(0, 10) : r.id}</span>
                </div>
                <b>{r._score}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
