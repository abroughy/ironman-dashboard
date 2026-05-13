'use client'
import { useState } from 'react'
import type { CoachingSummaryContent } from '@/lib/coaching'

interface Props {
  summary: (CoachingSummaryContent & { generatedAt: string }) | null
}

export default function CoachingCard({ summary: initial }: Props) {
  const [summary, setSummary] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleRegenerate() {
    setLoading(true)
    setConfirming(false)
    const res = await fetch('/api/coaching/regenerate', { method: 'POST' })
    const data = await res.json()
    setSummary({ ...data, generatedAt: new Date().toISOString() })
    setLoading(false)
  }

  if (!summary) {
    return (
      <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5">
        <p className="text-gray-400 text-sm mb-3">No coaching summary yet.</p>
        <button
          onClick={() => setConfirming(true)}
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          Generate now
        </button>
        {confirming && (
          <div className="mt-2 text-sm text-gray-300">
            This will call the Claude API.{' '}
            <button onClick={handleRegenerate} className="text-orange-400 underline">Confirm</button>
            {' '}·{' '}
            <button onClick={() => setConfirming(false)} className="text-gray-400 underline">Cancel</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Weekly Coaching Summary</h3>
        <button
          onClick={() => setConfirming(true)}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-orange-400"
        >
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
      </div>
      {confirming && !loading && (
        <p className="text-xs text-gray-400">
          This calls the Claude API.{' '}
          <button onClick={handleRegenerate} className="text-orange-400 underline">Confirm</button>
          {' '}·{' '}
          <button onClick={() => setConfirming(false)} className="text-gray-400 underline">Cancel</button>
        </p>
      )}
      <div className="space-y-2 text-sm">
        <div><span className="text-green-400 font-medium">✓ Went well: </span><span className="text-gray-300">{summary.wentWell}</span></div>
        <div><span className="text-amber-400 font-medium">⚠ Watch: </span><span className="text-gray-300">{summary.weakness}</span></div>
        <div><span className="text-blue-400 font-medium">→ Focus: </span><span className="text-gray-300">{summary.nextFocus}</span></div>
        {summary.projectedFinish && (
          <div className="pt-2 border-t border-white/5 text-gray-400 text-xs">
            Projected finish: <span className="text-white font-mono">{summary.projectedFinish.best} – {summary.projectedFinish.avg}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600">Generated {new Date(summary.generatedAt).toLocaleDateString()}</p>
    </div>
  )
}
