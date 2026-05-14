'use client'
import { useState } from 'react'

interface TargetContext {
  raceName: string | null
  raceType: string
  raceLabel: string
  weeksLeft: number | null
  phase: string
  targets: { swim: number; bike: number; run: number }
  currentVol: { swim: number; bike: number; run: number }
}

export default function TargetExplainer() {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [context, setContext] = useState<TargetContext | null>(null)
  const [error, setError] = useState('')

  async function explain() {
    setLoading(true)
    setError('')
    setExplanation('')
    try {
      const res = await fetch('/api/coaching/explain-targets', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to get explanation')
      const data = await res.json()
      setExplanation(data.explanation)
      setContext(data.context)
    } catch {
      setError('Could not generate explanation — check your Anthropic API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-400">Weekly targets</h2>
          <p className="text-xs text-gray-600 mt-0.5">Ask AI why your targets are set this way</p>
        </div>
        <button
          onClick={explain}
          disabled={loading}
          className="flex items-center gap-2 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-3 py-1.5 rounded-lg border border-white/5 transition-colors"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Explain my targets
            </>
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {context && (
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4 space-y-3">
          {/* Context pills */}
          <div className="flex flex-wrap gap-2">
            {context.raceName ? (
              <span className="text-xs bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-full">
                {context.raceName}
              </span>
            ) : (
              <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">
                General Fitness
              </span>
            )}
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {context.phase} Phase
            </span>
            {context.weeksLeft !== null && (
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {context.weeksLeft} weeks to race
              </span>
            )}
          </div>

          {/* Target breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['swim', 'bike', 'run'] as const).map(d => {
              const target = context.targets[d]
              const current = context.currentVol[d]
              const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
              return (
                <div key={d} className="bg-gray-800/50 rounded-lg p-2">
                  <p className="text-xs text-gray-500 capitalize mb-1">{d}</p>
                  <p className="text-sm font-semibold text-white">{target.toFixed(0)}<span className="text-xs text-gray-500">km</span></p>
                  <p className="text-xs text-gray-600">{current.toFixed(1)}km done · {pct}%</p>
                </div>
              )
            })}
          </div>

          {/* AI explanation */}
          {explanation && (
            <div className="border-t border-white/5 pt-3">
              <p className="text-xs font-medium text-orange-400 mb-2">Coach analysis</p>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{explanation}</p>
            </div>
          )}
        </div>
      )}

      {explanation && !context && (
        <p className="text-sm text-gray-300 leading-relaxed">{explanation}</p>
      )}
    </section>
  )
}
