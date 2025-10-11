function DevBanner(){
  if (!import.meta.env.DEV) return null
  const missing = ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID'].filter(k => !import.meta.env[k])
  if (missing.length === 0) return null
  return (
    <div style={{background:'#3b1d1d', color:'#fecaca', padding:'8px 12px', borderBottom:'1px solid #7f1d1d'}}>
      <b>Dev warning:</b> missing env(s) {missing.join(', ')} — some features may not work. See <a style={{color:'#fecaca'}} href="/diag">/diag</a>.
    </div>
  )
}

// src/components/AppShell.jsx
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { auth, db } from '../lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

// Set your owner UID here (same as in Firestore rules)
const OWNER_UID = '0lUAgnE3S1hshWPCpB4K6hXwvh43'

const TITLE_BY_PATH = {
  '/': 'Station 1 Fit',
  '/weekly': 'Weekly Challenge',
  '/monthly': 'Monthly Challenge',
  '/members': 'Members',
  '/leaderboard': 'Leaderboard',
  '/standards': 'Standards',
  '/standards-board': 'Standards Status',
  '/weekly-admin': 'Weekly Admin',
  '/tier-checkoff': 'Tier Checkoff',
  '/diag': 'Diagnostics',
  '/permtest': 'Permissions Test',
  '/login': 'Sign In',
  '/admin-standards': 'Edit Standards',
}

const MAIN_TABS = [
  { to:'/weekly',      label:'Weekly',     icon:'📅' },
  { to:'/monthly',     label:'Monthly',    icon:'✅' },
  { to:'/members',     label:'Members',    icon:'👥' },
  { to:'/leaderboard', label:'Leaders',    icon:'🏆' },
  { to:'/standards',   label:'Standards',  icon:'📏' },
]

export default function AppShell({ children }) {
  const { pathname } = useLocation()
  const [user, setUser] = useState(() => auth.currentUser)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)

  const title = TITLE_BY_PATH[pathname] || 'Station 1 Fit'
  const isOwner = (user?.uid === OWNER_UID)
  const isMentor = role === 'mentor' || role === 'admin' || isOwner

  // Track auth changes
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUser(u))
    return () => unsub()
  }, [])

  // Load profile/role when authed
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) { setProfile(null); setRole(null); return }
      try {
        const snap = await getDoc(doc(db, 'profiles', user.uid))
        if (!cancelled) {
          const data = snap.exists() ? snap.data() : {}
          setProfile({ id: user.uid, ...data })
          setRole(data.role || 'member')
        }
      } catch {
        if (!cancelled) {
          setProfile({ id: user.uid })
          setRole('member')
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  return (
    <div className="app-wrap" style={{ minHeight:'100dvh', background:'#0f172a' }}>
      {/* Top header */}
      <div
        className="app-header"
        style={{
          position:'sticky', top:0, zIndex:40,
          width:'100%', background:'#0f172a', color:'#fff',
          borderBottom:'1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div
          style={{
            width:'100%', maxWidth:760, margin:'0 auto',
            padding:'10px 12px', display:'flex', alignItems:'center', gap:10
          }}
        >
          <Link to="/" style={{ textDecoration:'none', color:'#fff', fontWeight:900 }}>
            Station 1 Fit
          </Link>
          <div style={{ opacity:.85, fontWeight:700, marginLeft:6 }}>{title}</div>
          <div style={{ marginLeft:'auto' }} className="hstack">
            {isMentor && <span className="badge" style={badgeStyles('#1d4ed8','#bfdbfe','#fff')}>Mentor</span>}
            {isOwner && <span className="badge" style={badgeStyles('#065f46','#d1fae5','#fff')}>Owner</span>}
            {user ? (
              <button
                onClick={()=>auth.signOut()}
                className="btn"
                style={{ marginLeft:8, background:'#ef4444', color:'#fff', border:'none', borderRadius:10, padding:'6px 10px', fontWeight:800 }}
              >
                Logout
              </button>
            ) : (
              <Link
                to="/login"
                className="btn"
                style={{ marginLeft:8, background:'#fff', color:'#0f172a', border:'none', borderRadius:10, padding:'6px 10px', fontWeight:800, textDecoration:'none' }}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="app-main" style={{ padding:'12px' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          {children}
        </div>
      </div>

      {/* Bottom tab bar (mobile-first) */}
      <nav
        className="app-tabbar"
        style={{
          position:'sticky', bottom:0, zIndex:30,
          width:'100%', background:'rgba(15,23,42,0.98)', backdropFilter:'saturate(180%) blur(6px)',
          borderTop:'1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div
          style={{
            maxWidth:760, margin:'0 auto',
            display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4, padding:'6px 8px'
          }}
        >
          {MAIN_TABS.map(t=>{
            const active = pathname === t.to
            return (
              <Link
                key={t.to}
                to={t.to}
                onClick={()=>setMoreOpen(false)}
                style={{
                  textDecoration:'none', color:'#fff',
                  display:'flex',flexDirection:'column',alignItems:'center', gap:4,
                  padding:'6px 8px', borderRadius:10,
                  background: active ? 'rgba(255,255,255,.12)' : 'transparent'
                }}
              >
                <div style={{fontSize:20,lineHeight:1}}>{t.icon}</div>
                <div style={{fontSize:11,fontWeight:700,opacity:active?1:.85}}>{t.label}</div>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={()=>setMoreOpen(o=>!o)}
            aria-expanded={moreOpen}
            className="btn ghost"
            style={{ border:'none', background:'transparent', color:'#fff' }}
          >
            <div style={{display:'flex',flexDirection:'column',alignItems:'center', gap:4}}>
              <div style={{fontSize:20,lineHeight:1}}>⋯</div>
              <div style={{fontSize:11,fontWeight:700,opacity:.95}}>More</div>
            </div>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div
          onClick={()=>setMoreOpen(false)}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,.25)',
            display:'flex', alignItems:'flex-end', zIndex:50
          }}
        >
          <div
            onClick={(e)=>e.stopPropagation()}
            className="card"
            style={{
              borderRadius:'18px 18px 0 0', padding:'12px',
              width:'100%', maxWidth:760, margin:'0 auto', background:'#fff'
            }}
          >
            <div className="vstack" style={{ gap:8 }}>
              <SheetLink to="/" label="Home" onClose={()=>setMoreOpen(false)} />
              <SheetLink to="/standards-board" label="Standards Board" onClose={()=>setMoreOpen(false)} />
              <SheetLink to="/diag" label="Diagnostics" onClose={()=>setMoreOpen(false)} />
              <SheetLink to="/permtest" label="Permissions Test" onClose={()=>setMoreOpen(false)} />

              {/* Mentor/Admin/Owner quick links */}
              {isMentor && (
                <>
                  <SheetLink to="/weekly-admin" label="Weekly Admin" onClose={()=>setMoreOpen(false)} />
                  <SheetLink to="/monthly-admin" label="Monthly Admin" onClose={()=>setMoreOpen(false)} />
                  <SheetLink to="/tier-checkoff" label="Tier Checkoff" onClose={()=>setMoreOpen(false)} />
                </>
              )}

              {/* Owner-only admin */}
              {isOwner && (
                <SheetLink to="/admin-standards" label="Admin: Edit Standards" onClose={()=>setMoreOpen(false)} />
              )}

              {/* Auth shortcut */}
              {!user ? (
                <SheetLink to="/login" label="Login" onClose={()=>setMoreOpen(false)} />
              ) : (
                <button
                  onClick={()=>{ setMoreOpen(false); auth.signOut() }}
                  className="btn"
                  style={{ width:'100%', background:'#ef4444', color:'#fff', border:'none', borderRadius:12, padding:'10px', fontWeight:800 }}
                >
                  Logout
                </button>
              )}
            </div>

            <button className="btn" style={{ width:'100%', marginTop:10 }} onClick={()=>setMoreOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SheetLink({ to, label, onClose }) {
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <Link
      to={to}
      onClick={onClose}
      className="hstack"
      style={{
        justifyContent:'space-between', textDecoration:'none', color:'#0f172a',
        padding:'12px 14px', border:'1px solid #e5e7eb',
        borderRadius:12, background: active ? '#f1f5f9' : '#fff'
      }}
    >
      <span style={{ fontWeight:800 }}>{label}</span>
      <span style={{ color:'#64748b' }}>›</span>
    </Link>
  )
}

function badgeStyles(bg, tint, fg) {
  return {
    background:bg,
    color:fg,
    padding:'4px 8px',
    borderRadius:999,
    fontWeight:800,
    fontSize:12,
    border:`1px solid ${tint}`,
  }
}
