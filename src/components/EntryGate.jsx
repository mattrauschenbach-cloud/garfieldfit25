// src/components/EntryGate.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { db } from "../lib/firebase"
import useAuth from "../lib/auth"
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"

// Rotate these (served from /public)
const IMAGES = ["/entry1.jpg", "/entry2.jpg", "/entry3.jpg", "/entry4.jpg"]
const INTERVAL_MS = 4000
const DEFAULT_QUOTE = "The success you’re looking for waits in the work you’re avoiding."

export default function EntryGate({ onEnter }) {
  const { user, profile } = useAuth()
  const role = profile?.role || "member"
  const isOwner = role === "owner"

  const [visible, setVisible] = useState(true)
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)
  const timerRef = useRef(null)

  // Quote (from Firestore with fallback)
  const [quote, setQuote] = useState(DEFAULT_QUOTE)
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState(DEFAULT_QUOTE)
  const [saving, setSaving] = useState(false)

  // Preload images
  useEffect(() => { IMAGES.forEach(src => { const i = new Image(); i.src = src }) }, [])

  // Rotate images
  useEffect(() => {
    if (!visible) return
    timerRef.current = setInterval(() => {
      setFade(false)
      setTimeout(() => { setIdx(i => (i + 1) % IMAGES.length); setFade(true) }, 250)
    }, INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [visible])

  // Subscribe to Firestore quote (settings/entryGate)
  useEffect(() => {
    const ref = doc(db, "settings", "entryGate")
    const unsub = onSnapshot(ref, snap => {
      const q = snap.exists() ? (snap.data().quote || DEFAULT_QUOTE) : DEFAULT_QUOTE
      setQuote(q)
      if (!edit) setDraft(q)
    })
    return unsub
  }, [edit])

  async function saveQuote(){
    if (!isOwner) return
    const val = (draft || "").trim()
    if (!val) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, "settings", "entryGate"),
        {
          quote: val,
          updatedAt: serverTimestamp(),
          updatedByUid: user?.uid || null,
          updatedByName: profile?.displayName || user?.email || "owner"
        },
        { merge: true }
      )
      setEdit(false)
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  function handleEnter(){
    // No remember; shows again next load
    setVisible(false)
    onEnter?.()
  }

  if (!visible) return null

  return (
    <div style={bgWrap} role="dialog" aria-modal="true" aria-label="Entry Portal">
      {/* background carousel */}
      <div style={bgLayer}>
        {IMAGES.map((src, i) => (
          <div
            key={src}
            style={{
              ...bgImage,
              opacity: i === idx && fade ? 1 : 0,
              backgroundImage: `url(${src})`
            }}
            aria-hidden="true"
          />
        ))}
        <div style={overlay} />
      </div>

      {/* Foreground card */}
      <div style={Card} className="vstack">
        <h1 style={{ margin: 0, textAlign:"center" }}>Station 1 Fitness</h1>

        {/* Quote + owner editor */}
        {!edit ? (
          <div style={{ color: "#e5e7eb", fontSize: 18, marginTop: 8, textAlign: "center" }}>
            {quote}
            {isOwner && (
              <button
                onClick={()=>{ setEdit(true); setDraft(quote) }}
                style={editBtn}
                title="Edit quote"
              >
                ✎
              </button>
            )}
          </div>
        ) : (
          <div className="vstack" style={{ gap: 8, marginTop: 8 }}>
            <textarea
              rows={3}
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              style={ta}
            />
            <div className="hstack" style={{ gap: 8, justifyContent:"center", flexWrap:"wrap" }}>
              <button className="btn" style={Btn} onClick={saveQuote} disabled={saving}>
                {saving ? "Saving…" : "Save quote"}
              </button>
              <button className="btn" style={LinkBtn} onClick={()=>setEdit(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 18, width: "100%", maxWidth: 420 }}>
          <button style={Btn} onClick={handleEnter}>Enter & Commit</button>
        </div>

        {/* No skip button on purpose */}
      </div>
    </div>
  )
}

/* ===== styles ===== */
const bgWrap = { position:"fixed", inset:0, zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", background:"#000" }
const bgLayer = { position:"absolute", inset:0 }
const bgImage = {
  position:"absolute", inset:0,
  backgroundSize:"cover", backgroundPosition:"center",
  transition:"opacity .35s ease"
}
const overlay = { position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.7) 100%)" }
const Card = {
  position:"relative", width:"min(760px, 92vw)",
  background:"rgba(15,26,48,.78)", border:"1px solid #1f2937", borderRadius:18,
  padding:24, textAlign:"center", boxShadow:"0 10px 40px rgba(0,0,0,.6)", backdropFilter:"blur(2px)"
}
const Btn = { padding:"14px 16px", borderRadius:12, border:"1px solid #1f2937", background:"#172136", color:"#fff", cursor:"pointer", fontSize:16, fontWeight:700, width:"100%" }
const LinkBtn = { ...Btn, background:"transparent", color:"#cbd5e1", width:"auto", padding:"10px 12px", fontWeight:600, marginTop:10 }
const editBtn = {
  marginLeft: 8, border:"1px solid #1f2937", background:"#0f1a30", color:"#cbd5e1",
  padding:"2px 8px", borderRadius:8, cursor:"pointer", fontSize:12
}
const ta = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:10, padding:10, width:"min(680px, 92vw)", fontFamily:"inherit", lineHeight:1.4
}
