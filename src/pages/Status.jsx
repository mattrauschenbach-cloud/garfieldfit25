// src/pages/Status.jsx
export default function Status(){
  return (
    <div className="container vstack" style={{gap:12}}>
      <div className="card vstack" style={{gap:6}}>
        <span className="badge">Status</span>
        <h3 style={{margin:0}}>App is running</h3>
        <div style={{color:"#9ca3af"}}>
          This is a lightweight status page. You can remove this route later or expand it for diagnostics.
        </div>
      </div>
    </div>
  )
}
