'use client'
import { useState } from 'react'
import { scoreLabel } from '@/lib/wellness'

interface WellnessLog {
  sleepHours: number
  soreness: number
  energy: number
  score: number
}

interface WellnessWidgetProps {
  todayLog: WellnessLog | null
  showWarning: boolean
}

export default function WellnessWidget({ todayLog, showWarning }: WellnessWidgetProps) {
  const [sleep, setSleep] = useState('')
  const [soreness, setSoreness] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [logged, setLogged] = useState<WellnessLog | null>(todayLog)

  async function handleSubmit() {
    if (!sleep || soreness === null || energy === null) return
    const sleepHours = parseFloat(sleep)
    if (isNaN(sleepHours) || sleepHours < 0 || sleepHours > 24) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleepHours, soreness, energy }),
      })
      const data = await res.json() as WellnessLog
      setLogged(data)
    } finally {
      setSubmitting(false)
    }
  }

  const RatingButtons = ({
    value, onChange, label, hint,
  }: { value: number | null; onChange: (v: number) => void; label: string; hint?: string }) => (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-gray-300 text-xs">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                value === n
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {hint && <p className="text-[10px] text-gray-600 text-right mt-0.5">{hint}</p>}
    </div>
  )

  if (!logged) {
    return (
      <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">How are you feeling today?</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs">😴 Sleep</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              placeholder="7.5"
              value={sleep}
              onChange={e => setSleep(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 text-right"
            />
          </div>
          <RatingButtons value={soreness} onChange={setSoreness} label="💪 Soreness" hint="1 = fresh · 5 = very sore" />
          <RatingButtons value={energy} onChange={setEnergy} label="⚡ Energy" hint="1 = exhausted · 5 = great" />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !sleep || soreness === null || energy === null}
          className="mt-3 w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition-colors"
        >
          {submitting ? 'Saving…' : 'Log check-in'}
        </button>
      </div>
    )
  }

  const { label, colour, emoji } = scoreLabel(logged.score)

  return (
    <div className="space-y-2">
      <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recovery Score · Today</p>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
            logged.score >= 70 ? 'border-green-500 bg-green-500/10 text-green-400' :
            logged.score >= 45 ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' :
            'border-red-500 bg-red-500/10 text-red-400'
          }`}>
            {logged.score}
          </div>
          <div>
            <p className={`font-semibold text-sm ${colour}`}>{emoji} {label}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Sleep {logged.sleepHours}h · Soreness {logged.soreness} · Energy {logged.energy}
            </p>
          </div>
        </div>
      </div>

      {showWarning && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-base mt-0.5">⚠️</span>
          <p className="text-red-300 text-xs">Recovery has been low for 2 days. Consider an easy session or rest day today.</p>
        </div>
      )}
    </div>
  )
}
