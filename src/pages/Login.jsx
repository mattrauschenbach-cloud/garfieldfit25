import useAuth from "../lib/auth"

export default function Login(){
  const { signIn } = useAuth()
  return (
    <div className="container" style={{display:"grid", placeItems:"center", minHeight:"60vh"}}>
      <div className="card vstack" style={{maxWidth:420, width:"100%"}}>
        <h2 style={{margin:0}}>Sign in</h2>
        <p style={{color:"#9ca3af"}}>Use Google to continue.</p>
        <button className="btn primary" onClick={signIn}>Continue with Google</button>
      </div>
    </div>
  )
}
