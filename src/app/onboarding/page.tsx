'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const RACE_OPTIONS = [
  { type: '70.3', label: 'Half Ironman', sub: '1.9km swim · 90km bike · 21.1km run', icon: '🏊🚴🏃' },
  { type: '140.6', label: 'Full Ironman', sub: '3.8km swim · 180km bike · 42.2km run', icon: '⚡' },
  { type: 'olympic', label: 'Olympic Tri', sub: '1.5km swim · 40km bike · 10km run', icon: '🥇' },
  { type: 'sprint', label: 'Sprint Tri', sub: '750m swim · 20km bike · 5km run', icon: '💨' },
  { type: 'marathon', label: 'Marathon', sub: '42.2km run', icon: '🏃' },
  { type: 'half-marathon', label: 'Half Marathon', sub: '21.1km run', icon: '🏅' },
]

const PRIORITY_OPTIONS = [
  { value: 'A', label: 'A — Main goal race', sub: 'Peak for this, full taper', colour: 'border-orange-500 bg-orange-500/10 text-orange-400' },
  { value: 'B', label: 'B — Important tune-up', sub: 'Train through, partial taper', colour: 'border-blue-400 bg-blue-400/10 text-blue-400' },
  { value: 'C', label: 'C — Fun / fitness test', sub: 'No special prep', colour: 'border-gray-500 bg-gray-500/10 text-gray-400' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [raceType, setRaceType] = useState('')
  const [raceName, setRaceName] = useState('')
  const [raceDate, setRaceDate] = useState('')
  const [priority, setPriority] = useState('A')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceName, raceType, raceDate, priority }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Something went wrong')
        return
      }
      router.push('/')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="text-4xl font-bold text-orange-400 mb-1">⚡ 70.3</p>
          <p className="text-gray-400 text-sm">Let&apos;s set up your training plan</p>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">What are you training for?</h2>
            <p className="text-gray-500 text-sm mb-5">This shapes your training plan, targets, and coaching.</p>
            <div className="grid grid-cols-2 gap-3">
              {RACE_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => { setRaceType(opt.type); setStep(2) }}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    raceType === opt.type
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-white/10 bg-gray-900/60 hover:border-white/20'
                  }`}
                >
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className="font-semibold text-white text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-300 text-sm mb-5 flex items-center gap-1">
              ← Back
            </button>
            <h2 className="text-lg font-semibold text-white mb-1">Tell us about your race</h2>
            <p className="text-gray-500 text-sm mb-5">
              Your plan and coaching will count down to this date.
            </p>
            <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Race name
                </label>
                <input
                  type="text"
                  value={raceName}
                  onChange={e => setRaceName(e.target.value)}
                  placeholder="e.g. Ironman 70.3 Edinburgh"
                  className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Race date
                </label>
                <input
                  type="date"
                  value={raceDate}
                  onChange={e => setRaceDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Priority
                </label>
                <div className="space-y-2">
                  {PRIORITY_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        priority === p.value
                          ? p.colour
                          : 'border-white/10 bg-gray-800/40 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <span className="font-semibold text-sm">{p.label}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={!raceDate || loading}
              className="w-full mt-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Setting up…' : 'Start training →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
