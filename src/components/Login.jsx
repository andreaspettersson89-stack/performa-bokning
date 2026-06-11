import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const EMAIL = 'andreas.pettersson89@live.se'

export default function Login() {
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const signIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password })
    setLoading(false)
    if (error) setError('Fel lösenord, försök igen.')
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <div className="app-logo" style={{ justifyContent: 'center', marginBottom: 32 }}>
        <span className="app-logo-performa">PERFORMA</span>
        <span className="app-logo-rehab">MÖTEN</span>
      </div>
      <form className="card" onSubmit={signIn}>
        <div className="field">
          <label>Lösenord</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
          />
        </div>
        <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
          {loading ? 'Loggar in…' : 'Logga in'}
        </button>
        {error && <p style={{ marginTop: 12, color: 'var(--orange)', fontSize: '0.85rem' }}>{error}</p>}
      </form>
    </div>
  )
}
