'use client'
import { useState } from 'react'

interface Props { onSaved: () => void }

export default function ManualEntryForm({ onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today, durationMins: '', durationSecs: '', distanceMetres: '',
    avgHeartRate: '', perceivedEffort: '5', notes: '',
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
    const durationSecs = parseInt(form.durationMins) * 60 + parseInt(form.durationSecs || '0')
    const body = {
      discipline: 'swim',
      date: form.date,
      durationSecs,
      distanceMetres: parseFloat(form.distanceMetres),
      avgHeartRate: form.avgHeartRate ? parseInt(form.avgHeartRate) : undefined,
      perceivedEffort: parseInt(form.perceivedEffort),
      notes: form.notes || undefined,
      source: 'manual',
    }
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { onSaved() } else { setError('Failed to save session') }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" required />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Distance (metres)</label>
          <input type="number" value={form.distanceMetres} onChange={e => set('distanceMetres', e.target.value)}
            placeholder="e.g. 1800" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" required />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Duration (mm:ss)</label>
          <div className="flex gap-1">
            <input type="number" value={form.durationMins} onChange={e => set('durationMins', e.target.value)}
              placeholder="mm" min="0" className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" required />
            <span className="text-gray-400 self-center">:</span>
            <input type="number" value={form.durationSecs} onChange={e => set('durationSecs', e.target.value)}
              placeholder="ss" min="0" max="59" className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Avg HR (optional)</label>
          <input type="number" value={form.avgHeartRate} onChange={e => set('avgHeartRate', e.target.value)}
            placeholder="e.g. 145" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Perceived effort: {form.perceivedEffort}/10</label>
        <input type="range" min="1" max="10" value={form.perceivedEffort} onChange={e => set('perceivedEffort', e.target.value)}
          className="w-full accent-orange-500" />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Notes / stroke focus</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="e.g. bilateral breathing drills, focused on catch"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-20" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={saving}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save swim session'}
      </button>
    </form>
  )
}
