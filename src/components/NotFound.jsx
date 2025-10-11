export default function NotFound(){
  return (
    <div className="container">
      <div className="card vstack" style={{alignItems:'center', textAlign:'center', padding:32}}>
        <div className="badge">404</div>
        <h1 style={{margin:0}}>Page not found</h1>
        <p style={{color:'#9ca3af', marginTop:6}}>The page you’re looking for doesn’t exist.</p>
        <div className="hstack" style={{marginTop:10}}>
          <a className="btn" href="/">Go home</a>
          <a className="btn ghost" href="/diag">Open diagnostics</a>
        </div>
      </div>
    </div>
  )
}
