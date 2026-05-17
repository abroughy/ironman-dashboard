'use client'
import { useState } from 'react'

interface Props { onSaved: () => void }

const DISCIPLINES = [
  { value: 'swim',    label: 'Swim',    emoji: '🏊', hasDistance: true },
  { value: 'bike',    label: 'Bike',    emoji: '🚴', hasDistance: true },
  { value: 'run',     label: 'Run',     emoji: '🏃', hasDistance: true },
  { value: 'weights', label: 'Weights', emoji: '🏋️', hasDistance: false },
  { value: 'other',   label: 'Other',   emoji: '⚡', hasDistance: false },
]

export default function ManualEntryForm({ onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [discipline, setDiscipline] = useState('swim')
  const [form, setForm] = useState({
    date: today, durationMins: '', durationSecs: '', distanceMetres: '',
    avgHeartRate: '', perceivedEffort: '5', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const discInfo = DISCIPLINES.find(d => d.value === discipline)!

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const durationSecs = parseInt(form.durationMins || '0') * 60 + parseInt(form.durationSecs || '0')
    if (!durationSecs) { setError('Duration is required'); return }
    if (discInfo.hasDistance && !form.distanceMetres) { setError('Distance is required'); return }

    setSaving(true)
    const body = {
      discipline,
      date: form.date,
      durationSecs,
      distanceMetres: discInfo.hasDistance ? parseFloat(form.distanceMetres) : (form.distanceMetres ? parseFloat(form.distanceMetres) : 0),
      avgHeartRate: form.avgHeartRate ? parseInt(form.avgHeartRate) : undefined,
      perceivedEffort: parseInt(form.perceivedEffort),
      notes: form.notes || undefined,
      source: 'manual',
    }
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() } else { setError('Failed to save session') }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Discipline picker */}
      <div>
        <label className="text-xs text-gray-400 block mb-2">Type</label>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINES.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDiscipline(d.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                discipline === d.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
              }`}
            >
              <span>{d.emoji}</span> {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          <label className="text-xs text-gray-400 block mb-1">
            Distance (metres){!discInfo.hasDistance && <span className="text-gray-600"> — optional</span>}
          </label>
          <input
            type="number"
            value={form.distanceMetres}
            onChange={e => set('distanceMetres', e.target.value)}
            placeholder={discipline === 'swim' ? 'e.g. 1800' : discipline === 'bike' ? 'e.g. 19000' : 'e.g. 5000'}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            required={discInfo.hasDistance}
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Duration</label>
          <div className="flex gap-1 items-center">
            <input
              type="number"
              value={form.durationMins}
              onChange={e => set('durationMins', e.target.value)}
              placeholder="min"
              min="0"
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white"
              required
            />
            <span className="text-gray-500 text-xs">m</span>
            <input
              type="number"
              value={form.durationSecs}
              onChange={e => set('durationSecs', e.target.value)}
              placeholder="sec"
              min="0"
              max="59"
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white"
            />
            <span className="text-gray-500 text-xs">s</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Avg HR (optional)</label>
          <input
            type="number"
            value={form.avgHeartRate}
            onChange={e => set('avgHeartRate', e.target.value)}
            placeholder="e.g. 145"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1">Perceived effort: {form.perceivedEffort}/10</label>
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
          placeholder={
            discipline === 'swim' ? 'e.g. bilateral breathing drills' :
            discipline === 'weights' ? 'e.g. upper body — bench press, rows, shoulder press' :
            discipline === 'other' ? 'e.g. yoga flow, spin class, pilates' :
            'e.g. easy zone 2, treadmill'
          }
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-16"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : `Save ${discInfo.emoji} ${discInfo.label} session`}
      </button>
    </form>
  )
}
