import { useState } from "react"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"

export default function AddWeeklyEntry(){
  const { user } = useAuth()
  const [score, setScore] = useState("")
  const [saving, setSaving] = useState(false)
  if (!user) return null

  async function save(e){
    e.preventDefault()
    if (!score) return
    setSaving(true)
    const weekId = new Date().toISOString().slice(0,10) // YYYY-MM-DD (or your own week key)
    await setDoc(
      doc(db, "profiles", user.uid, "weekly", weekId),
      { score: Number(score), createdAt: serverTimestamp() },
      { merge: true }
    )
    setSaving(false)
    setScore("")
  }

  return (
    <form onSubmit={save} className="hstack" style={{gap:8}}>
      <input
        type="number"
        min="0"
        placeholder="Score"
        value={score}
        onChange={e=>setScore(e.target.value)}
        style={{background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937", borderRadius:8, padding:"8px 10px"}}
      />
      <button className="btn primary" disabled={saving || !score}>
        {saving ? "Saving…" : "Add weekly"}
      </button>
    </form>
  )
}
