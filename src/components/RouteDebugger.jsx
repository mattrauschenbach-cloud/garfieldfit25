import { useLocation, Link } from "react-router-dom"

export default function RouteDebugger(){
  const loc = useLocation()
  const links = [
    "/", "/login", "/members", "/monthly",
    "/monthly-admin", "/admin-standards",
    "/owner", "/owner/members", "/diag"
  ]
  return (
    <div className="card" style={{margin:"16px auto", maxWidth:800}}>
      <div className="badge">Route Debugger</div>
      <p style={{marginTop:8}}>location.pathname: <code>{loc.pathname}</code></p>
      <div className="hstack" style={{flexWrap:"wrap", gap:8}}>
        {links.map(href => (
          <Link key={href} to={href} className="btn ghost">{href}</Link>
        ))}
      </div>
      <p style={{color:"#9ca3af", marginTop:8}}>
        If clicking a link shows NotFound, the path doesn’t match any <code>&lt;Route path="…" /&gt;</code> in <code>App.jsx</code>.
      </p>
    </div>
  )
}
