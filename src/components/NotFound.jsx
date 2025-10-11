import { Link } from "react-router-dom"
export default function NotFound(){
  return (
    <div className="container">
      <div className="card vstack">
        <div className="badge">Not found</div>
        <p>The page you’re looking for doesn’t exist.</p>
        <Link className="btn" to="/">Go home</Link>
      </div>
    </div>
  )
}
