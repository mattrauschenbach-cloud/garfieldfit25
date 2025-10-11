import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="container-xx">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-8">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Station 1 Fit — Garfield Heights
        </h1>
        <p className="mt-2 text-white/80 max-w-2xl">
          Track standards, log weekly & monthly challenges, and mentor your team to elite performance.
        </p>
        <div className="mt-4 flex gap-2">
          <Link to="/weekly" className="btn-primary">Log this week</Link>
          <Link to="/leaderboard" className="btn-ghost bg-white/10 text-white">Leaderboard</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="card p-4">
          <h3 className="font-semibold">Weekly Challenge</h3>
          <p className="text-slate-600 text-sm">Submit your totals and see shift standings.</p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold">Monthly Challenge</h3>
          <p className="text-slate-600 text-sm">Mark completed months and chase streaks.</p>
        </div>
        <div className="card p-4">
          <h3 className="font-semibold">Tier Checkoff</h3>
          <p className="text-slate-600 text-sm">Mentors record attempts and progress on all standards.</p>
        </div>
      </section>
    </div>
  )
}
