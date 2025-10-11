export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 container-xx py-6">
        {children}
      </main>
      <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Station 1 Fit
      </footer>
    </div>
  )
}
