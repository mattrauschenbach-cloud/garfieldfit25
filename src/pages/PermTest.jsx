import { useState } from 'react'
import { db, auth } from '../lib/firebase'
import { doc, setDoc } from 'firebase/firestore'

function weekId(){ const d=new Date(); const y=d.getFullYear(); const onejan=new Date(d.getFullYear(),0,1); const week=Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7); return `${y}-W${String(week).padStart(2,'0')}` }
function monthId(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }

export default function PermTest(){
  const [out, setOut] = useState('')

  const testWeekly = async () => {
    try{
      const wk = weekId()
      await setDoc(doc(db,'weekly_logs',wk,'entries', auth.currentUser.uid), {
        ownerId: auth.currentUser.uid,
        value: Math.floor(Math.random()*100),
        createdAt: Date.now(),
      }, { merge:true })
      setOut(`OK: wrote weekly entry to weekly_logs/${wk}/entries/${auth.currentUser.uid}`)
    }catch(e){ setOut(`WEEKLY ERROR: ${e.code || e.message}`) }
  }

  const testMonthly = async () => {
    try{
      const mo = monthId()
      await setDoc(doc(db,'monthly_logs',mo,'entries', auth.currentUser.uid), {
        ownerId: auth.currentUser.uid,
        completed: true,
        notes: 'perm test',
        createdAt: Date.now(),
      }, { merge:true })
      setOut(`OK: wrote monthly entry to monthly_logs/${mo}/entries/${auth.currentUser.uid}`)
    }catch(e){ setOut(`MONTHLY ERROR: ${e.code || e.message}`) }
  }

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-lg font-bold">Permission Test</h2>
      <button className="border px-3 py-2 rounded" onClick={testWeekly}>Test Weekly Write</button>
      <button className="border px-3 py-2 rounded" onClick={testMonthly}>Test Monthly Write</button>
      <pre className="bg-slate-100 p-2 rounded text-sm">{out}</pre>
    </div>
  )
}
