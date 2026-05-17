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

interface Exercise {
  name: string
  sets: string
  reps: string
  weight: string
}

const EMPTY_EXERCISE: Exercise = { name: '', sets: '', reps: '', weight: '' }

function buildExerciseNotes(exercises: Exercise[], unit: 'kg' | 'lbs'): string | undefined {
  const filled = exercises.filter(e => e.name.trim())
  if (!filled.length) return undefined
  return JSON.stringify({
    unit,
    exercises: filled.map(e => ({
      name: e.name.trim(),
      sets: e.sets ? parseInt(e.sets) : null,
      reps: e.reps ? parseInt(e.reps) : null,
      weight: e.weight ? parseFloat(e.weight) : null,
    })),
  })
}

export default function ManualEntryForm({ onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [discipline, setDiscipline] = useState('swim')
  const [form, setForm] = useState({
    date: today, durationMins: '', durationSecs: '', distanceMetres: '',
    avgHeartRate: '', perceivedEffort: '5', notes: '',
  })
  // Weights-specific state
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [exercises, setExercises] = useState<Exercise[]>([
    { ...EMPTY_EXERCISE }, { ...EMPTY_EXERCISE }, { ...EMPTY_EXERCISE }, { ...EMPTY_EXERCISE },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const discInfo = DISCIPLINES.find(d => d.value === discipline)!

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setExercise(i: number, key: keyof Exercise, value: string) {
    setExercises(prev => prev.map((ex, idx) => idx === i ? { ...ex, [key]: value } : ex))
  }

  function addExercise() {
    setExercises(prev => [...prev, { ...EMPTY_EXERCISE }])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const durationSecs = parseInt(form.durationMins || '0') * 60 + parseInt(form.durationSecs || '0')
    if (!durationSecs) { setError('Duration is required'); return }
    if (discInfo.hasDistance && !form.distanceMetres) { setError('Distance is required'); return }

    const notes = discipline === 'weights'
      ? buildExerciseNotes(exercises, weightUnit)
      : (form.notes || undefined)

    setSaving(true)
    const body = {
      discipline,
      date: form.date,
      durationSecs,
      distanceMetres: discInfo.hasDistance
        ? parseFloat(form.distanceMetres)
        : (form.distanceMetres ? parseFloat(form.distanceMetres) : 0),
      avgHeartRate: form.avgHeartRate ? parseInt(form.avgHeartRate) : undefined,
      perceivedEffort: parseInt(form.perceivedEffort),
      notes,
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

        {discipline !== 'weights' && (
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
        )}

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
          type="range" min="1" max="10" value={form.perceivedEffort}
          onChange={e => set('perceivedEffort', e.target.value)}
          className="w-full accent-orange-500"
        />
      </div>

      {/* Weights: structured exercise log */}
      {discipline === 'weights' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">Exercises</label>
            {/* kg / lbs toggle */}
            <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
              {(['kg', 'lbs'] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setWeightUnit(u)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    weightUnit === u ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_52px_52px_64px] gap-1.5 px-0.5">
            <span className="text-[10px] text-gray-600 uppercase tracking-wide">Exercise</span>
            <span className="text-[10px] text-gray-600 uppercase tracking-wide text-center">Sets</span>
            <span className="text-[10px] text-gray-600 uppercase tracking-wide text-center">Reps</span>
            <span className="text-[10px] text-gray-600 uppercase tracking-wide text-center">{weightUnit}</span>
          </div>

          {exercises.map((ex, i) => (
            <div key={i} className="grid grid-cols-[1fr_52px_52px_64px] gap-1.5 items-center">
              <input
                type="text"
                value={ex.name}
                onChange={e => setExercise(i, 'name', e.target.value)}
                placeholder={i === 0 ? 'e.g. Bench press' : i === 1 ? 'e.g. Deadlift' : 'Exercise'}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 w-full"
              />
              <input
                type="number"
                value={ex.sets}
                onChange={e => setExercise(i, 'sets', e.target.value)}
                placeholder="3"
                min="1"
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white text-center w-full"
              />
              <input
                type="number"
                value={ex.reps}
                onChange={e => setExercise(i, 'reps', e.target.value)}
                placeholder="10"
                min="1"
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white text-center w-full"
              />
              <input
                type="number"
                value={ex.weight}
                onChange={e => setExercise(i, 'weight', e.target.value)}
                placeholder="60"
                min="0"
                step="0.5"
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white text-center w-full"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addExercise}
            className="text-xs text-orange-400 hover:text-orange-300 font-medium"
          >
            + Add exercise
          </button>
        </div>
      ) : (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder={
              discipline === 'other' ? 'e.g. yoga flow, spin class, pilates' :
              'e.g. easy zone 2, treadmill'
            }
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-16"
          />
        </div>
      )}

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
