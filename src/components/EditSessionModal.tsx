'use client'
import { useState } from 'react'

interface Session {
  id: string
  discipline: string
  date: string
  durationSecs: number
  distanceMetres: number
  avgHeartRate?: number | null
  perceivedEffort?: number | null
  notes?: string | null
  source: string
}

interface Props {
  session: Session
  onClose: () => void
  onSaved: () => void
}

export default function EditSessionModal({ session, onClose, onSaved }: Props) {
  const initialMins = Math.floor(session.durationSecs / 60)
  const initialSecs = session.durationSecs % 60

  const [form, setForm] = useState({
    discipline: session.discipline,
    date: session.date.split('T')[0],
    distanceMetres: String(session.distanceMetres),
    durationMins: String(initialMins),
    durationSecs: String(initialSecs).padStart(2, '0'),
    avgHeartRate: session.avgHeartRate != null ? String(session.avgHeartRate) : '',
    perceivedEffort: String(session.perceivedEffort ?? 5),
    notes: session.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const durationSecs =
      parseInt(form.durationMins || '0') * 60 + parseInt(form.durationSecs || '0')

    const body: Record<string, unknown> = {
      discipline: form.discipline,
      date: form.date,
      durationSecs,
      distanceMetres: parseFloat(form.distanceMetres),
      perceivedEffort: parseInt(form.perceivedEffort),
      notes: form.notes || null,
      avgHeartRate: form.avgHeartRate ? parseInt(form.avgHeartRate) : null,
    }

    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save session')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Edit session</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Discipline</label>
              <select
                value={form.discipline}
                onChange={e => set('discipline', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="swim">🏊 Swim</option>
                <option value="bike">🚴 Bike</option>
                <option value="run">🏃 Run</option>
                <option value="weights">🏋️ Weights</option>
                <option value="other">⚡ Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Distance (metres)</label>
              <input
                type="number"
                value={form.distanceMetres}
                onChange={e => set('distanceMetres', e.target.value)}
                placeholder="e.g. 1800"
                min="0"
                step="any"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Duration (mm:ss)</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={form.durationMins}
                  onChange={e => set('durationMins', e.target.value)}
                  placeholder="mm"
                  min="0"
                  className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  required
                />
                <span className="text-gray-400 self-center">:</span>
                <input
                  type="number"
                  value={form.durationSecs}
                  onChange={e => set('durationSecs', e.target.value)}
                  placeholder="ss"
                  min="0"
                  max="59"
                  className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Avg HR (optional)</label>
              <input
                type="number"
                value={form.avgHeartRate}
                onChange={e => set('avgHeartRate', e.target.value)}
                placeholder="e.g. 145"
                min="0"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Perceived effort: {form.perceivedEffort}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={form.perceivedEffort}
              onChange={e => set('perceivedEffort', e.target.value)}
              className="w-full accent-orange-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="e.g. bilateral breathing drills, focused on catch"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-20"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
