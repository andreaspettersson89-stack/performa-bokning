import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function BookingPublic({ code }) {
  const [session, setSession] = useState(null)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(null)

  useEffect(() => { loadSession() }, [code])

  async function loadSession() {
    setLoading(true)
    const { data: sessionData } = await supabase
      .rpc('get_booking_session', { p_code: code.toUpperCase() })
      .maybeSingle()

    if (!sessionData) {
      setError('Ogiltig bokningslänk. Kontakta Performa Rehab & FHV för hjälp.')
      setLoading(false)
      return
    }

    setSession(sessionData)

    const { data: slotsData } = await supabase
      .rpc('get_booking_slots', { p_session_id: sessionData.id })

    setSlots(slotsData || [])
    setLoading(false)
  }

  async function bookSlot() {
    if (!name.trim() || !booking) return
    setSaving(true)

    const { data, error: err } = await supabase
      .rpc('book_slot', { p_slot_id: booking.id, p_name: name.trim() })
      .maybeSingle()

    if (err || !data) {
      alert('Denna tid hann bli bokad av någon annan. Välj en annan tid.')
      await loadSession()
    } else {
      setConfirmed(data)
      setSlots(prev => prev.map(s => s.id === data.id ? { ...s, is_booked: true } : s))
    }

    setBooking(null)
    setName('')
    setSaving(false)
  }

  const slotsByDate = slots.reduce((acc, s) => {
    if (!acc[s.slot_date]) acc[s.slot_date] = []
    acc[s.slot_date].push(s)
    return acc
  }, {})

  const availableCount = slots.filter(s => !s.is_booked).length

  if (loading) return (
    <p style={{ textAlign: 'center', marginTop: 80, color: '#aaa' }}>Laddar…</p>
  )

  if (error) return (
    <div style={{ textAlign: 'center', marginTop: 80, padding: '0 24px' }}>
      <div className="app-logo" style={{ justifyContent: 'center' }}>
        <span className="app-logo-performa" translate="no">PERFORMA</span>
        <span className="app-logo-rehab" translate="no">BOKNING</span>
      </div>
      <p style={{ color: '#e57373', marginTop: 32 }}>{error}</p>
    </div>
  )

  return (
    <div>
      <div className="app-logo">
        <span className="app-logo-performa" translate="no">PERFORMA</span>
        <span className="app-logo-rehab" translate="no">BOKNING</span>
      </div>

      <p className="page-title">{session.company_name}</p>
      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 24 }}>
        Klicka på en ledig tid och skriv in ditt namn för att boka.
        {availableCount > 0 && ` ${availableCount} tid${availableCount !== 1 ? 'er' : ''} kvar.`}
      </p>

      {/* Bekräftelse */}
      {confirmed && (
        <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <p style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>Tid bokad!</p>
          <p style={{ fontSize: '0.88rem', color: '#388e3c' }}>
            {formatDate(confirmed.slot_date)}, {confirmed.start_time.slice(0, 5)}–{confirmed.end_time.slice(0, 5)}
            {' '}— {confirmed.booked_by_name}
          </p>
          <p style={{ fontSize: '0.78rem', color: '#66bb6a', marginTop: 6 }}>
            Performa Rehab & FHV kommer att kontakta er med mer information.
          </p>
        </div>
      )}

      {/* Bokningsformulär */}
      {booking && (
        <div style={{ background: 'var(--teal-pale)', border: '1px solid var(--teal-light)', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
          <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--teal-dark)' }}>
            {formatDate(booking.slot_date)}&nbsp;&nbsp;{booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Ditt för- och efternamn</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="För- och efternamn"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && bookSlot()}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={bookSlot} disabled={saving || !name.trim()}>
              {saving ? 'Bokar…' : 'Bekräfta bokning'}
            </button>
            <button className="btn-secondary" onClick={() => { setBooking(null); setName('') }}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Tidsluckor per datum */}
      {slots.length === 0 && (
        <div className="empty">Inga tider tillgängliga just nu.</div>
      )}

      {Object.entries(slotsByDate).map(([date, daySlots]) => (
        <div key={date} style={{ marginBottom: 20 }}>
          <p className="section-label">{formatDate(date)}</p>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {daySlots.map((slot, i) => {
              const isBooked = slot.is_booked
              const isActive = booking?.id === slot.id
              return (
                <div
                  key={slot.id}
                  onClick={() => !isBooked && !isActive && setBooking(slot)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '13px 18px',
                    borderBottom: i < daySlots.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: isBooked ? 'default' : 'pointer',
                    background: isActive ? 'var(--teal-pale)' : 'white',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isBooked && !isActive) e.currentTarget.style.background = '#f5fcfd' }}
                  onMouseLeave={e => { if (!isBooked && !isActive) e.currentTarget.style.background = 'white' }}
                >
                  <span style={{
                    fontWeight: 700,
                    minWidth: 120,
                    fontSize: '0.92rem',
                    color: isBooked ? '#ccc' : 'var(--charcoal)',
                  }}>
                    {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                  </span>

                  {isBooked ? (
                    <span className="badge" style={{ background: '#f5f5f5', color: '#bbb', fontSize: '0.75rem' }}>
                      Bokad
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--teal)', fontWeight: 600 }}>
                      Ledig — tryck för att boka
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#ccc', marginTop: 32 }}>
        Performa Rehab & FHV
      </p>
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
}
