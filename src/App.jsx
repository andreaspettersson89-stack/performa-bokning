import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import Login from './components/Login.jsx'
import BookingAdmin from './components/BookingAdmin.jsx'
import BookingPublic from './components/BookingPublic.jsx'
import './index.css'

const bookingCode = new URLSearchParams(window.location.search).get('boka')

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (bookingCode) return <BookingPublic code={bookingCode} />

  if (loading) return <p style={{ textAlign: 'center', marginTop: 60, color: '#aaa' }}>Laddar…</p>
  if (!session) return <Login />

  return (
    <>
      <div className="app-logo">
        <span className="app-logo-performa">PERFORMA</span>
        <span className="app-logo-rehab">BOKNING</span>
      </div>

      <BookingAdmin />

      <button
        onClick={() => supabase.auth.signOut()}
        style={{ display: 'block', margin: '32px auto 0', background: 'none', border: 'none', color: '#c0bdb5', cursor: 'pointer', fontSize: 12, letterSpacing: '0.04em' }}
      >
        Logga ut
      </button>
    </>
  )
}
