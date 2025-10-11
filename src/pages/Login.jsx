import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { auth, provider } from '../lib/firebase'
import { signInWithPopup } from 'firebase/auth'

export default function Login(){
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || "/"

  async function signIn(){
    try{
      setLoading(true)
      setError(null)
      await signInWithPopup(auth, provider)
      navigate(from, { replace: true })
    }catch(err){
      setError(err?.message || String(err))
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{display:'grid', placeItems:'center', minHeight:'70vh'}}>
      <div className="card vstack" style={{maxWidth:420, width:'100%', padding:24}}>
        <h1 style={{margin:0}}>Sign in</h1>
        <p style={{color:'#9ca3af', marginTop:6}}>
          Use your Google account to continue.
        </p>
        {error && <div className="card" style={{borderColor:'#7f1d1d', background:'#1f1315', color:'#fecaca'}}>{error}</div>}
        <button className="btn primary" onClick={signIn} disabled={loading}>
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>
        <p className="footer" style={{margin:0}}>
          You’ll be redirected back to the page you were trying to view.
        </p>
      </div>
    </div>
  )
}
