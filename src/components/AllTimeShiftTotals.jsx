// src/components/AllTimeShiftTotals.jsx
import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"

const statCard = {
  minWidth: 180,
  padding:"14px 16px",
  border:"1px solid #1f2937",
  background:"#0f1a30",
  borderRadius:14
}
const statLabel = { color:"#9ca3af", fontSize:12 }
const statValue = { fontSize:28, fontWeight:800, lineHeight:1, marginTop:4, color:"#e5e7eb" }
const subtle = { color:"#9ca3af", fontSize:12 }

function SumForShift({ shift }) {
  const [teamTotal, setTeamTotal] = useState(0)
  const [mine, setMine] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    const ref = collection(db, "stats", "shifts", shift, "totals")
    const unsub = onSnapshot(ref, snap => {
      let sum = 0
      let myVal = null
      snap.forEach(d => {
        const v = Number(d.data()?.total) || 0
        sum += v
        if (user?.uid && d.id === user.uid) myVal = v
      })
      setTeamTotal(sum)
      setMine(myVal)
    })
    return unsub
  }, [shift, user?.uid])

  return (
    <div style={statCard}>
      <div style={statLabel}>Shift {shift} total</div>
      <div style={statValue}>{teamTotal}</div>
      {mine != null && <div style={subtle}>Your total: <b style={{color:"#e5e7eb"}}>{mine}</b></div>}
    </div>
  )
}

export default function AllTimeShiftTotals() {
  return (
    <div className="grid" style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))"}}>
      <SumForShift shift="A" />
      <SumForShift shift="B" />
      <SumForShift shift="C" />
    </div>
  )
}
