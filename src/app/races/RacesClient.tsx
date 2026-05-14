'use client'
import { useEffect, useState, useCallback } from 'react'
import { RACE_CONFIGS } from '@/lib/raceConfig'

interface Race {
  id: string
  name: string
  raceType: string
  date: string
  priority: string
  notes: string | null
}

const RACE_OPTIONS = [
  { type: '70.3', label: 'Half Ironman', sub: '1.9km swim · 90km bike · 21.1km run', icon: '🏊🚴🏃' },
  { type: '140.6', label: 'Full Ironman', sub: '3.8km swim · 180km bike · 42.2km run', icon: '⚡' },
  { type: 'olympic', label: 'Olympic Tri', sub: '1.5km swim · 40km bike · 10km run', icon: '🥇' },
  { type: 'sprint', label: 'Sprint Tri', sub: '750m swim · 20km bike · 5km run', icon: '💨' },
  { type: 'marathon', label: 'Marathon', sub: '42.2km run', icon: '🏃' },
  { type: 'half-marathon', label: 'Half Marathon', sub: '21.1km run', icon: '🏅' },
]

const PRIORITY_OPTIONS = [
  { value: 'A', label: 'A', desc: 'Main goal race, peak for this', textColour: 'text-orange-400', badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  { value: 'B', label: 'B', desc: 'Important tune-up, train through', textColour: 'text-blue-400', badgeClass: 'bg-blue-400/20 text-blue-400 border-blue-400/40' },
  { value: 'C', label: 'C', desc: 'Fun race / fitness test', textColour: 'text-gray-400', badgeClass: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
]

function getPriorityOption(p: string) {
  return PRIORITY_OPTIONS.find(o => o.value === p) ?? PRIORITY_OPTIONS[2]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function weeksFromNow(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24 * 7))
}

function getRaceLabel(raceType: string) {
  return RACE_CONFIGS[raceType as keyof typeof RACE_CONFIGS]?.label ?? raceType
}

const EMPTY_FORM = { name: '', raceType: '', date: '', priority: 'A', notes: '' }

export default function RacesClient() {
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRace, setEditingRace] = useState<Race | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchRaces = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/races')
    if (res.ok) setRaces(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchRaces() }, [fetchRaces])

  function openCreate() {
    setEditingRace(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(race: Race) {
    setEditingRace(race)
    setForm({
      name: race.name,
      raceType: race.raceType,
      date: race.date.split('T')[0],
      priority: race.priority,
      notes: race.notes ?? '',
    })
    setFormError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingRace(null)
    setFormError('')
  }

  async function saveRace() {
    if (!form.name.trim() || !form.raceType || !form.date) {
      setFormError('Race name, type, and date are required')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const url = editingRace ? `/api/races/${editingRace.id}` : '/api/races'
      const method = editingRace ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          raceType: form.raceType,
          date: form.date,
          priority: form.priority,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setFormError(d.error ?? 'Something went wrong')
        return
      }
      closeModal()
      showToast(editingRace ? 'Race updated' : 'Race added')
      fetchRaces()
    } catch {
      setFormError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRace(id: string) {
    setDeleting(true)
    const res = await fetch(`/api/races/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteConfirm(null)
    if (res.ok) {
      showToast('Race deleted')
      fetchRaces()
    }
  }

  const now = new Date().toISOString()
  const upcoming = races.filter(r => r.date >= now)
  const past = races.filter(r => r.date < now).reverse()

  function RaceCard({ race }: { race: Race }) {
    const pOpt = getPriorityOption(race.priority)
    const isUpcoming = race.date >= now
    const weeks = weeksFromNow(race.date)
    return (
      <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${pOpt.badgeClass}`}>
                {pOpt.label}
              </span>
              <span className="font-semibold text-white text-sm truncate">{race.name}</span>
            </div>
            <p className="text-xs text-gray-500">{getRaceLabel(race.raceType)}</p>
            <p className="text-xs text-gray-400 mt-1">{formatDate(race.date)}</p>
            {isUpcoming && weeks > 0 && (
              <p className="text-xs text-orange-400/70 mt-0.5">{weeks} week{weeks !== 1 ? 's' : ''} away</p>
            )}
            {isUpcoming && weeks <= 0 && (
              <p className="text-xs text-orange-400 mt-0.5 font-medium">Race week!</p>
            )}
            {race.notes && (
              <p className="text-xs text-gray-600 mt-1.5 italic">{race.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openEdit(race)}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setDeleteConfirm(race.id)}
              className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Race Calendar</h1>
          <p className="text-sm text-gray-400 mt-0.5">All your events this season</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add race
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>
      ) : races.length === 0 ? (
        <div className="text-center py-16 bg-gray-900/40 border border-white/5 rounded-2xl">
          <p className="text-2xl mb-3">🏁</p>
          <p className="text-white font-medium mb-1">No races yet</p>
          <p className="text-gray-500 text-sm mb-4">Add your first event to start planning</p>
          <button
            onClick={openCreate}
            className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Add your first race
          </button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map(r => <RaceCard key={r.id} race={r} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Past</h2>
              <div className="space-y-3 opacity-60">
                {past.map(r => <RaceCard key={r.id} race={r} />)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold">{editingRace ? 'Edit race' : 'Add race'}</h2>

            {/* Race name */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Race name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ironman 70.3 Edinburgh"
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                autoComplete="off"
              />
            </div>

            {/* Race type grid */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Race type</label>
              <div className="grid grid-cols-2 gap-2">
                {RACE_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, raceType: opt.type }))}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      form.raceType === opt.type
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-white/10 bg-gray-800/60 hover:border-white/20'
                    }`}
                  >
                    <div className="text-lg mb-1">{opt.icon}</div>
                    <div className="font-medium text-white text-xs">{opt.label}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Race date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Priority</label>
              <div className="space-y-1.5">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm ${
                      form.priority === p.value
                        ? p.badgeClass
                        : 'border-white/10 bg-gray-800/40 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <span className="font-semibold">{p.label}</span>
                    <span className="text-xs text-gray-500 ml-2">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Notes <span className="text-gray-600">(optional)</span></label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any extra notes…"
                rows={2}
                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={closeModal}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRace}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : editingRace ? 'Save changes' : 'Add race'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-red-400">Remove race?</h2>
            <p className="text-sm text-gray-300">This will remove the race from your calendar.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteRace(deleteConfirm)}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
