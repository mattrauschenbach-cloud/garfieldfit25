// src/components/HomeMessages.jsx
import { useEffect, useMemo, useState } from "react"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import {
  addDoc, collection, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc
} from "firebase/firestore"

const input = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:8, padding:"8px 10px", width:"100%"
}
const btn = {
  padding:"8px 12px", borderRadius:10, border:"1px solid #1f2937",
  background:"#172136", color:"#fff", cursor:"pointer"
}
const subtle = { color:"#9ca3af", fontSize:12 }

export default function HomeMessages(){
  const { user, profile } = useAuth()
  const role = profile?.role || "member"
  const isStaff = ["mentor","admin","owner"].includes(role)

  const [msgs, setMsgs] = useState([])
  const [err, setErr] = useState(null)

  // editor state (create)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)

  // edit state (inline)
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editPinned, setEditPinned] = useState(false)

  useEffect(() => {
    const qy = query(collection(db, "messages"), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(qy, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
      // Put pinned items on top (client-sort), then by createdAt desc
      arr.sort((a,b) => {
        const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0
        if (pa !== pb) return pb - pa
        const ta = a.createdAt?.seconds || 0, tb = b.createdAt?.seconds || 0
        return tb - ta
      })
      setMsgs(arr)
      setErr(null)
    }, e => setErr(e))
    return unsub
  }, [])

  async function createMsg(e){
    e.preventDefault()
    if (!isStaff) return
    if (!title.trim() || !body.trim()) return
    setBusy(true)
    try {
      await addDoc(collection(db, "messages"), {
        title: title.trim(),
        body: body.trim(),
        pinned: !!pinned,
        authorUid: user?.uid || null,
        authorName: profile?.displayName || user?.email || "staff",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      setTitle(""); setBody(""); setPinned(false)
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function startEdit(m){
    setEditingId(m.id)
    setEditTitle(m.title || "")
    setEditBody(m.body || "")
    setEditPinned(!!m.pinned)
  }

  async function saveEdit(id){
    try {
      await updateDoc(doc(db, "messages", id), {
        title: editTitle.trim(),
        body: editBody.trim(),
        pinned: !!editPinned,
        updatedAt: serverTimestamp()
      })
      setEditingId(null)
    } catch (e) {
      alert(e.message || String(e))
    }
  }

  async function remove(id){
    if (!confirm("Delete this message?")) return
    try { await deleteDoc(doc(db, "messages", id)) }
    catch(e){ alert(e.message || String(e)) }
  }

  const empty = msgs.length === 0

  return (
    <div className="vstack" style={{gap:12}}>
      <div className="hstack" style={{justifyContent:"space-between", gap:8, flexWrap:"wrap"}}>
        <div className="hstack" style={{gap:8, alignItems:"center"}}>
          <span className="badge">Announcements</span>
          {!empty && <span style={subtle}>{msgs.length} message{msgs.length>1?"s":""}</span>}
        </div>
      </div>

      {/* Create form (staff only) */}
      {isStaff && (
        <form onSubmit={createMsg} className="vstack card" style={{gap:8}}>
          <input
            placeholder="Title"
            value={title} onChange={e=>setTitle(e.target.value)}
            style={input}
          />
          <textarea
            rows={4}
            placeholder="Write your message…"
            value={body} onChange={e=>setBody(e.target.value)}
            style={{...input, fontFamily:"inherit", lineHeight:1.4}}
          />
          <div className="hstack" style={{gap:10, alignItems:"center", flexWrap:"wrap"}}>
            <label style={{display:"inline-flex", alignItems:"center", gap:6, color:"#e5e7eb"}}>
              <input
                type="checkbox" checked={pinned}
                onChange={e=>setPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <button className="btn primary" style={btn} disabled={busy} type="submit">
              {busy ? "Posting…" : "Post message"}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {empty ? (
        <div className="card" style={{color:"#9ca3af"}}>No announcements yet.</div>
      ) : (
        <div className="vstack" style={{gap:10}}>
          {msgs.map(m => {
            const ts = m.updatedAt?.toDate?.() || m.createdAt?.toDate?.()
            const when = ts ? ts.toLocaleString() : "—"
            const isEditing = editingId === m.id
            return (
              <div key={m.id} className="card vstack" style={{gap:8}}>
                {/* View mode */}
                {!isEditing && (
                  <>
                    <div className="hstack" style={{justifyContent:"space-between", gap:8, flexWrap:"wrap"}}>
                      <div className="hstack" style={{gap:8, alignItems:"center", flexWrap:"wrap"}}>
                        {m.pinned && <span className="badge">PINNED</span>}
                        <h3 style={{margin:"0"}}>{m.title || "Untitled"}</h3>
                      </div>
                      <div style={subtle}>
                        by <b>{m.authorName || "staff"}</b> • {when}
                      </div>
                    </div>
                    <div style={{whiteSpace:"pre-wrap"}}>{m.body}</div>

                    {isStaff && (
                      <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
                        <button className="btn" style={btn} onClick={()=>startEdit(m)}>Edit</button>
                        <button className="btn" style={{...btn, background:"#7c1c1c", borderColor:"#5b1515"}} onClick={()=>remove(m.id)}>Delete</button>
                      </div>
                    )}
                  </>
                )}

                {/* Edit mode */}
                {isEditing && (
                  <>
                    <input
                      value={editTitle} onChange={e=>setEditTitle(e.target.value)}
                      style={input}
                    />
                    <textarea
                      rows={4}
                      value={editBody} onChange={e=>setEditBody(e.target.value)}
                      style={{...input, fontFamily:"inherit", lineHeight:1.4}}
                    />
                    <label style={{display:"inline-flex", alignItems:"center", gap:6, color:"#e5e7eb"}}>
                      <input
                        type="checkbox" checked={editPinned}
                        onChange={e=>setEditPinned(e.target.checked)}
                      />
                      Pin to top
                    </label>
                    <div className="hstack" style={{gap:8, flexWrap:"wrap"}}>
                      <button className="btn" style={btn} onClick={()=>saveEdit(m.id)}>Save</button>
                      <button className="btn" style={{...btn, background:"transparent"}} onClick={()=>setEditingId(null)}>Cancel</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {err && (
        <div className="card" style={{borderColor:"#7f1d1d", background:"#1f1315", color:"#fecaca"}}>
          Error: {String(err.message || err)}
        </div>
      )}
    </div>
  )
}
