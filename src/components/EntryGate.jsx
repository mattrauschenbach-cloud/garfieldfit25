// src/components/EntryGate.jsx
import { useEffect, useRef, useState } from "react"
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
    setVisible(false) // always shows again on reload
    onEnter?.()
  }

  if (!visible) return null

  return (
    <div style={wrap} role="dialog" aria-modal="true" aria-label="Entry Portal">
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

      {/* Bottom Group: card + button move together */}
      <div style={bottomGroup}>
        <div style={Card} className="vstack">
          <h1 style={{ margin: 0, textAlign:"center" }}>Station 1 Fitness</h1>

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
        </div>

        <button style={BigBtn} onClick={handleEnter}>Enter & Commit</button>
      </div>
    </div>
  )
}

/* ===== styles ===== */
const wrap = { position:"fixed", inset:0, zIndex:1000, overflow:"hidden", background:"#000" }
const bgLayer = { position:"absolute", inset:0 }
const bgImage = {
  position:"absolute", inset:0,
  backgroundSize:"cover", backgroundPosition:"center",
  transition:"opacity .35s ease"
}
const overlay = {
  position:"absolute", inset:0,
  background:"linear-gradient(180deg, rgba(0,0,0,.20) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.85) 100%)"
}

/* One group anchored from the bottom so both card & button move together */
const bottomGroup = {
  position:"absolute",
  left:"50%",
  transform:"translateX(-50%)",
  bottom:"10vh",              // ← move this to raise/lower everything together
  width:"min(880px, 92vw)",
  display:"flex",
  flexDirection:"column",
  alignItems:"center",
  gap:16,
  zIndex:1001
}

const Card = {
  width:"100%",
  background:"rgba(15,26,48,.58)", border:"1px solid #1f2937", borderRadius:18,
  padding:24, textAlign:"center", boxShadow:"0 10px 40px rgba(0,0,0,.6)", backdropFilter:"blur(2px)"
}

const BtnBase = {
  padding:"14px 16px",
  borderRadius:14,
  border:"1px solid #1f2937",
  background:"#172136",
  color:"#fff",
  cursor:"pointer",
  fontSize:16,
  fontWeight:700
}
const Btn = { ...BtnBase, width:"auto" }
const BigBtn = { ...BtnBase, fontSize:18, padding:"16px 18px", width:"min(680px, 92vw)" }
const LinkBtn = { ...Btn, background:"transparent", color:"#cbd5e1", padding:"10px 12px", fontWeight:600, marginTop:10 }

const editBtn = {
  marginLeft: 8, border:"1px solid #1f2937", background:"#0f1a30", color:"#cbd5e1",
  padding:"2px 8px", borderRadius:8, cursor:"pointer", fontSize:12
}
const ta = {
  background:"#0b1426", color:"#e5e7eb", border:"1px solid #1f2937",
  borderRadius:10, padding:10, width:"min(760px, 92vw)", fontFamily:"inherit", lineHeight:1.4
}
