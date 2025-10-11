import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { collection, onSnapshot, doc, updateDoc, setDoc, getDocs, query, where, getDoc as getDocFs } from 'firebase/firestore'
import { useAuthState } from '../lib/auth'

const TIERS = ['committed','developmental','advanced','elite']
const SHIFTS = ['A','B','C']

export default function Members() {
  const { profile } = useAuthState()
  const [members, setMembers] = useState([])
  const [mentors, setMentors] = useState([])
  const isMentor = profile?.role === 'mentor'

  useEffect(() => onSnapshot(collection(db, 'profiles'), (snap) => {
    setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }), [])

  useEffect(() => { (async ()=>{
    const qMentors = query(collection(db,'profiles'), where('role','==','mentor'))
    const s = await getDocs(qMentors)
    setMentors(s.docs.map(d => ({ id:d.id, ...d.data() })))
  })() }, [])

  const setTier = (uid, tier) => isMentor && updateDoc(doc(db, 'profiles', uid), { tier })
  const setShift = (uid, shift) => isMentor && updateDoc(doc(db, 'profiles', uid), { shift })
  const toggleCommitted = (uid, val) => isMentor && updateDoc(doc(db, 'profiles', uid), { isCommitted: val })
  const setRole = (uid, role) => isMentor && updateDoc(doc(db, 'profiles', uid), { role })
  const setMentorFor = (uid, mentorId, mentorName) => isMentor && updateDoc(doc(db,'profiles',uid), { mentorId, mentorName })

  const assignMaster = async (uid) => {
    const masterRef = doc(db,'config','standards_master')
    const masterSnap = await getDocFs(masterRef)
    const items = masterSnap.exists() ? (masterSnap.data().items || []) : []
    await setDoc(doc(db,'standards',uid), { items }, { merge:true })
  }

  const assignMasterAll = async () => {
    const masterRef = doc(db,'config','standards_master')
    const masterSnap = await getDocFs(masterRef)
    const items = masterSnap.exists() ? (masterSnap.data().items || []) : []
    for (const m of members) {
      await setDoc(doc(db,'standards',m.id), { items }, { merge:true })
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Members</h2>
      {!isMentor && <p className="text-sm text-slate-600">View only. Mentor tools are hidden.</p>}
      {isMentor && <div className="flex justify-end"><button className="text-sm border rounded px-2 py-1" onClick={assignMasterAll}>Assign master to ALL</button></div>}
      <div className="grid md:grid-cols-2 gap-3">
        {members.map(m => {
          const isThisMentor = m.role === 'mentor'
          return (
            <div key={m.id} className="border rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.displayName || 'Firefighter'}</div>
                  <div className="text-xs text-slate-500">
                    Role: {isThisMentor ? 'mentor' : 'member'} • Tier: {m.tier} • Shift: {m.shift || 'A'} • Committed: {m.isCommitted ? '✅' : '—'}
                    {m.mentorName ? ` • Mentor: ${m.mentorName}` : ''}
                  </div>
                </div>
                {isMentor && (
                  <div className="flex gap-2">
                    {isThisMentor
                      ? <button className="text-sm border rounded px-2 py-1" onClick={() => setRole(m.id, 'member')}>Remove mentor</button>
                      : <button className="text-sm border rounded px-2 py-1" onClick={() => setRole(m.id, 'mentor')}>Make mentor</button>}
                    <button className="text-sm border rounded px-2 py-1" onClick={() => assignMaster(m.id)}>Assign master</button>
                  </div>
                )}
              </div>

              {isMentor && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input className="border rounded px-2 py-1" defaultValue={m.displayName || ''} onBlur={(e)=>updateDoc(doc(db,'profiles',m.id), { displayName: e.target.value })} placeholder="Name"/>
                  <select className="border rounded px-2 py-1" value={m.tier || 'developmental'} onChange={e=>setTier(m.id, e.target.value)}>
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select className="border rounded px-2 py-1" value={m.shift || 'A'} onChange={e=>setShift(m.id, e.target.value)}>
                    {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <label className="text-sm flex items-center gap-1">
                    <input type="checkbox" checked={!!m.isCommitted} onChange={e=>toggleCommitted(m.id, e.target.checked)} />
                    committed
                  </label>
                  <select className="border rounded px-2 py-1" value={m.mentorId || ''} onChange={e=>{
                    const mentor = mentors.find(x=>x.id===e.target.value)
                    setMentorFor(m.id, mentor?.id || '', mentor?.displayName || '')
                  }}>
                    <option value="">— assign mentor —</option>
                    {mentors.map(mt => <option key={mt.id} value={mt.id}>{mt.displayName || 'Mentor'}</option>)}
                  </select>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
