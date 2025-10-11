import NavBar from "./NavBar"

export default function AppShell({ children }){
  return (
    <>
      <NavBar />
      <main style={{minHeight:"70vh"}}>{children}</main>
      <footer className="footer">Station 1 · Fit</footer>
    </>
  )
}
