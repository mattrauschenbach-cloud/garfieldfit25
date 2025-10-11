import { Link } from "react-router-dom"

export default function AccessDenied({ reason="You don’t have permission to view this page." }){
  return (
    <div className="container">
      <div className="card vstack" style={{alignItems:'center', textAlign:'center', padding:32}}>
        <div className="badge">Restricted</div>
        <h1 style={{margin:0}}>Access denied</h1>
        <p style={{color:'#9ca3af', marginTop:6}}>{reason}</p>
        <div className="hstack" style={{marginTop:10}}>
          <Link className="btn primary" to="/login">Sign in</Link>
          <Link className="btn ghost" to="/">Go home</Link>
        </div>
        <p style={{color:'#6b7280', fontSize:12, marginTop:14}}>
          Tip: if you recently got promoted to Mentor/Admin, sign out and back in to refresh your profile role.
        </p>
      </div>
    </div>
  )
}
