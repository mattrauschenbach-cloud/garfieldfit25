import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore'

const parseLines = (text) =>
  text.split(/\r?\n/).map(t => t.trim()).filter(Boolean).map(label => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g,'_'), label, target: ''
  }))

export default function StandardsImport() {
  const [raw, setRaw] = useState(''); const [msg, setMsg] = useState('')
  useEffect(()=>setMsg(''), [raw])

  const saveMaster = async e => {
    e.preventDefault()
    const items = parseLines(raw); if (!items.length) { setMsg('Add at least one line.'); return }
    await setDoc(doc(db,'config','standards_master'), { items }, { merge:true })
    setMsg('Saved master standards')
  }

  const assignToAll = async () => {
    const masterSnap = await getDoc(doc(db,'config','standards_master'))
    if (!masterSnap.exists()) { setMsg('Save master first.'); return }
    const master = masterSnap.data().items || []
    const people = await getDocs(collection(db,'profiles'))
    for (const p of people.docs) await setDoc(doc(db,'standards', p.id), { items: master }, { merge:true })
    setMsg('Assigned to all members')
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Master Standards</h2>
      <p className="text-sm text-slate-600">Paste one standard per line. Save, then Assign to all.</p>
      <textarea className="w-full border rounded p-3" rows="12" value={raw} onChange={e=>setRaw(e.target.value)} />
      <div className="flex items-center gap-2">
        <button onClick={saveMaster} className="px-3 py-2 rounded bg-slate-900 text-white">Save master</button>
        <button onClick={assignToAll} className="px-3 py-2 rounded border">Assign to all</button>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </section>
  )
}
