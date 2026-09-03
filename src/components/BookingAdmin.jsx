import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function BookingAdmin() {
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
  const [slots, setSlots] = useState([])
  const [view, setView] = useState('sessions') // 'sessions' | 'slots' | 'new-session'
  const [loading, setLoading] = useState(false)

  const [newSession, setNewSession] = useState({ name: '', company_name: '', access_code: '' })
  const [newSlot, setNewSlot] = useState({ slot_date: '', start_time: '', end_time: '', duration: 40 })

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    const { data } = await supabase
      .from('booking_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    setSessions(data || [])
  }

  async function loadSlots(sessionId) {
    const { data } = await supabase
      .from('booking_slots')
      .select('*')
      .eq('session_id', sessionId)
      .order('slot_date').order('start_time')
    setSlots(data || [])
  }

  async function createSession() {
    if (!newSession.name || !newSession.company_name || !newSession.access_code) return
    setLoading(true)
    const { error } = await supabase.from('booking_sessions').insert(newSession)
    if (!error) {
      setNewSession({ name: '', company_name: '', access_code: '' })
      await loadSessions()
      setView('sessions')
    }
    setLoading(false)
  }

  async function addSlot() {
    const generated = buildSlots(newSlot)
    if (generated.length === 0) return
    setLoading(true)

    // hoppa över tider som redan finns samma dag (dubbelklick / omtag)
    const existing = new Set(
      slots.filter(s => s.slot_date === newSlot.slot_date).map(s => s.start_time.slice(0, 5))
    )
    const rows = generated
      .filter(g => !existing.has(g.start_time))
      .map(g => ({ ...g, session_id: selected.id }))

    if (rows.length > 0) {
      await supabase.from('booking_slots').insert(rows)
    }
    setNewSlot({ slot_date: '', start_time: '', end_time: '', duration: newSlot.duration })
    await loadSlots(selected.id)
    setLoading(false)
  }

  async function deleteSlot(id) {
    await supabase.from('booking_slots').delete().eq('id', id)
    await loadSlots(selected.id)
  }

  async function clearBooking(id) {
    await supabase.from('booking_slots').update({ booked_by_name: null, booked_at: null }).eq('id', id)
    await loadSlots(selected.id)
  }

  async function toggleActive(session) {
    await supabase.from('booking_sessions').update({ is_active: !session.is_active }).eq('id', session.id)
    await loadSessions()
    if (selected?.id === session.id) setSelected(s => ({ ...s, is_active: !s.is_active }))
  }

  function openSession(session) {
    setSelected(session)
    loadSlots(session.id)
    setView('slots')
  }

  const bookingUrl = selected
    ? `${window.location.origin}${window.location.pathname}?boka=${selected.access_code}`
    : ''

  const slotsByDate = slots.reduce((acc, s) => {
    if (!acc[s.slot_date]) acc[s.slot_date] = []
    acc[s.slot_date].push(s)
    return acc
  }, {})

  const totalBooked = slots.filter(s => s.booked_by_name).length

  const preview = buildSlots(newSlot)
  const previewRest = restMinutes(newSlot)

  // ── Ny session ──────────────────────────────────────────────────
  if (view === 'new-session') return (
    <div>
      <button className="btn-text" onClick={() => setView('sessions')} style={{ marginBottom: 16 }}>
        ← Tillbaka
      </button>
      <p className="section-label">Nytt bokningsuppdrag</p>
      <div className="card">
        <div className="field">
          <label>Namn på uppdraget</label>
          <input
            value={newSession.name}
            onChange={e => setNewSession(p => ({ ...p, name: e.target.value }))}
            placeholder="ex. Skavsta Räddningstjänst Juni 2026"
          />
        </div>
        <div className="field">
          <label>Företag</label>
          <input
            value={newSession.company_name}
            onChange={e => setNewSession(p => ({ ...p, company_name: e.target.value }))}
            placeholder="ex. Skavsta Räddningstjänst"
          />
        </div>
        <div className="field">
          <label>Åtkomstkod (företaget loggar in med denna)</label>
          <input
            value={newSession.access_code}
            onChange={e => setNewSession(p => ({ ...p, access_code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
            placeholder="ex. SKAVSTA2026"
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
          />
        </div>
        <button
          className="btn-primary"
          onClick={createSession}
          disabled={loading || !newSession.name || !newSession.company_name || !newSession.access_code}
        >
          Skapa uppdrag
        </button>
      </div>
    </div>
  )

  // ── Hantera tider ────────────────────────────────────────────────
  if (view === 'slots' && selected) return (
    <div>
      <button className="btn-text" onClick={() => { setView('sessions'); setSelected(null) }} style={{ marginBottom: 16 }}>
        ← Alla uppdrag
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <p className="section-label" style={{ margin: 0 }}>{selected.company_name}</p>
        <button
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '4px 12px' }}
          onClick={() => toggleActive(selected)}
        >
          {selected.is_active ? 'Stäng bokning' : 'Öppna bokning'}
        </button>
      </div>

      {/* Bokningslänk */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Länk att skicka till företaget
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ fontSize: '0.78rem', background: 'var(--off-white)', padding: '7px 10px', borderRadius: 6, flex: 1, wordBreak: 'break-all', color: 'var(--teal-dark)' }}>
            {bookingUrl}
          </code>
          <button
            className="btn-secondary"
            style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
            onClick={() => navigator.clipboard.writeText(bookingUrl)}
          >
            Kopiera
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 8 }}>
          Åtkomstkod: <strong style={{ color: 'var(--charcoal)', letterSpacing: '0.06em' }}>{selected.access_code}</strong>
          &nbsp;·&nbsp; {totalBooked} av {slots.length} bokade
        </p>
      </div>

      {/* Lägg till tid */}
      <p className="section-label">Lägg till tid</p>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Datum</label>
            <input type="date" value={newSlot.slot_date} onChange={e => setNewSlot(p => ({ ...p, slot_date: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Från</label>
            <input type="time" value={newSlot.start_time} onChange={e => setNewSlot(p => ({ ...p, start_time: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Till</label>
            <input type="time" value={newSlot.end_time} onChange={e => setNewSlot(p => ({ ...p, end_time: e.target.value }))} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Längd per tid</label>
            <select
              value={newSlot.duration}
              onChange={e => setNewSlot(p => ({ ...p, duration: Number(e.target.value) }))}
            >
              <option value={20}>20 minuter</option>
              <option value={30}>30 minuter</option>
              <option value={40}>40 minuter</option>
              <option value={45}>45 minuter</option>
              <option value={60}>60 minuter</option>
              <option value={0}>Hela tiden som ett block</option>
            </select>
          </div>
        </div>

        {preview.length > 0 && (
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: 10 }}>
            {newSlot.duration === 0
              ? `Skapar 1 tid: ${preview[0].start_time}–${preview[0].end_time}`
              : `Skapar ${preview.length} tid${preview.length !== 1 ? 'er' : ''} à ${newSlot.duration} min: ${preview[0].start_time}, ${preview.length > 1 ? preview[1].start_time + ', ' : ''}… ${preview[preview.length - 1].start_time}–${preview[preview.length - 1].end_time}`}
            {previewRest > 0 && ` · ${previewRest} min blir över i slutet`}
          </p>
        )}

        <button
          className="btn-primary"
          style={{ marginTop: 12 }}
          onClick={addSlot}
          disabled={loading || preview.length === 0}
        >
          {preview.length > 1 ? `+ Lägg till ${preview.length} tider` : '+ Lägg till tid'}
        </button>
      </div>

      {/* Tidslista */}
      {Object.keys(slotsByDate).length === 0 && (
        <div className="empty">Inga tider tillagda än</div>
      )}

      {Object.entries(slotsByDate).map(([date, daySlots]) => (
        <div key={date} style={{ marginBottom: 16 }}>
          <p className="section-label">{formatDate(date)}</p>
          <div className="card">
            {daySlots.map(slot => (
              <div key={slot.id} className="task-row">
                <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: 110 }}>
                  {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                </span>
                {slot.booked_by_name ? (
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{slot.booked_by_name}</span>
                ) : (
                  <span style={{ flex: 1, fontSize: '0.82rem', color: '#bbb', fontStyle: 'italic' }}>Ledig</span>
                )}
                {slot.booked_by_name && (
                  <button
                    className="btn-text"
                    style={{ color: '#e57373', fontSize: '0.8rem' }}
                    onClick={() => clearBooking(slot.id)}
                  >
                    Rensa
                  </button>
                )}
                {!slot.booked_by_name && (
                  <button
                    className="btn-text"
                    style={{ color: '#e57373', fontSize: '0.8rem' }}
                    onClick={() => deleteSlot(slot.id)}
                  >
                    Ta bort
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  // ── Uppdragslista ────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="section-label" style={{ margin: 0 }}>Bokningsuppdrag</p>
        <button
          className="btn-primary"
          style={{ fontSize: '0.82rem', padding: '6px 14px' }}
          onClick={() => setView('new-session')}
        >
          + Nytt uppdrag
        </button>
      </div>

      {sessions.length === 0 && (
        <div className="empty">Inga uppdrag skapade än</div>
      )}

      {sessions.map(session => (
        <div
          key={session.id}
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => openSession(session)}
        >
          <div className="card-header">
            <div>
              <p className="card-title">{session.company_name}</p>
              <p className="card-meta">{session.name}</p>
            </div>
            <span className={`badge ${session.is_active ? 'badge-pending' : 'badge-done'}`}>
              {session.is_active ? 'Öppen' : 'Stängd'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Tidsberäkning ──────────────────────────────────────────────────
function toMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function toTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Delar upp ett tidsspann i lika långa tider. duration 0 = ett enda block.
function buildSlots({ slot_date, start_time, end_time, duration }) {
  if (!slot_date || !start_time || !end_time) return []
  const start = toMinutes(start_time)
  const end = toMinutes(end_time)
  if (end <= start) return []

  const len = Number(duration) || 0
  if (len === 0) return [{ slot_date, start_time, end_time }]

  const out = []
  for (let t = start; t + len <= end; t += len) {
    out.push({ slot_date, start_time: toTime(t), end_time: toTime(t + len) })
  }
  return out
}

// Minuter som inte får plats i en hel tid på slutet
function restMinutes({ start_time, end_time, duration }) {
  const len = Number(duration) || 0
  if (!start_time || !end_time || len === 0) return 0
  const span = toMinutes(end_time) - toMinutes(start_time)
  if (span <= 0) return 0
  return span % len
}
