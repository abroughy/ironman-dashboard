'use client'
import { scoreLabel } from '@/lib/wellness'

interface LogEntry {
  date: string
  sleepHours: number
  soreness: number
  energy: number
  score: number
}

export default function RecoveryClient({ logs }: { logs: LogEntry[] }) {
  // Build a 14-day window (oldest first) with gaps for days not logged
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const days: { dateStr: string; label: string; log: LogEntry | null; isToday: boolean }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    const log = logs.find(l => l.date.startsWith(iso)) ?? null
    const isToday = i === 0
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
    days.push({ dateStr: iso, label, log, isToday })
  }

  const logsWithData = logs
  const avgSleep = logsWithData.length ? (logsWithData.reduce((s, l) => s + l.sleepHours, 0) / logsWithData.length).toFixed(1) : '—'
  const avgSoreness = logsWithData.length ? (logsWithData.reduce((s, l) => s + l.soreness, 0) / logsWithData.length).toFixed(1) : '—'
  const avgEnergy = logsWithData.length ? (logsWithData.reduce((s, l) => s + l.energy, 0) / logsWithData.length).toFixed(1) : '—'

  const maxScore = 100

  function barColour(score: number) {
    if (score >= 70) return 'bg-green-500'
    if (score >= 45) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-4">
      {/* 14-day bar chart */}
      <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Recovery Score — Last 14 Days</p>
        <div className="flex items-end gap-1 h-28">
          {days.map(({ dateStr, log, isToday }) => {
            const height = log ? `${(log.score / maxScore) * 100}%` : '4px'
            const colour = log ? barColour(log.score) : 'bg-gray-700'
            const border = isToday && !log ? 'border border-dashed border-gray-600' : ''
            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                {log && (
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 flex-col items-center">
                    <span>{scoreLabel(log.score).emoji} {log.score}</span>
                    <span className="text-gray-400">Sleep {log.sleepHours}h</span>
                  </div>
                )}
                <div
                  className={`w-full rounded-t transition-all ${colour} ${border}`}
                  style={{ height }}
                />
              </div>
            )
          })}
        </div>
        {/* x-axis labels — show every 7 days to avoid clutter */}
        <div className="flex mt-1">
          {days.map(({ dateStr, label }, i) => (
            <div key={dateStr} className="flex-1 text-center">
              {(i === 0 || i === 6 || i === 13) && (
                <span className="text-gray-600 text-[9px]">{label}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metric averages */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900/60 rounded-xl p-3 border border-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">😴 Sleep avg</p>
          <p className="text-lg font-bold text-white">{avgSleep}<span className="text-xs text-gray-500">h</span></p>
        </div>
        <div className="bg-gray-900/60 rounded-xl p-3 border border-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">💪 Soreness</p>
          <p className="text-lg font-bold text-yellow-400">{avgSoreness}<span className="text-xs text-gray-500">/5</span></p>
        </div>
        <div className="bg-gray-900/60 rounded-xl p-3 border border-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">⚡ Energy</p>
          <p className="text-lg font-bold text-green-400">{avgEnergy}<span className="text-xs text-gray-500">/5</span></p>
        </div>
      </div>

      {logs.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">No check-ins yet. Log your first one from the dashboard.</p>
      )}
    </div>
  )
}
