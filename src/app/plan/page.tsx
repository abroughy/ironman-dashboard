'use client'
import { useEffect, useState, useCallback } from 'react'
import { Workout } from '@/lib/workouts'

// ─── types (mirrors API serialised shape) ────────────────────────────────────

interface PlannedDayData {
  date: string
  isToday: boolean
  isRest: boolean
  completedSessionIds: string[]
  workouts: Workout[]
}

interface WeekPlanData {
  weekStart: string
  weekNumber: number
  phase: 'Build' | 'Peak' | 'Taper'
  days: PlannedDayData[]
}

// ─── discipline colours ───────────────────────────────────────────────────────

const DISCIPLINE_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  swim: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    dot: 'bg-blue-400',
  },
  bike: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    text: 'text-orange-300',
    dot: 'bg-orange-400',
  },
  run: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    text: 'text-green-300',
    dot: 'bg-green-400',
  },
  gym: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-300',
    dot: 'bg-purple-400',
  },
}

const PHASE_COLOURS: Record<string, string> = {
  Build: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  Peak: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  Taper: 'bg-green-500/20 text-green-300 border border-green-500/30',
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`
  return `${metres} m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function weekLabel(iso: string): string {
  return `Week of ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
}

// ─── sub-components ───────────────────────────────────────────────────────────

function WorkoutCard({
  workout,
  completed,
  expanded,
  onToggle,
}: {
  workout: Workout
  completed: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const styles = DISCIPLINE_STYLES[workout.discipline] ?? DISCIPLINE_STYLES.swim

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left rounded-lg border p-2.5 transition-all ${styles.bg} ${styles.border} focus:outline-none`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
          <span className={`text-xs font-semibold truncate ${styles.text}`}>{workout.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {completed && (
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5 font-medium">
              ✓
            </span>
          )}
          <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-1 flex items-center gap-2 text-gray-400" style={{ fontSize: '11px' }}>
        <span>{workout.targetDurationMins} min</span>
        {workout.targetDistanceMetres && (
          <>
            <span>·</span>
            <span>{formatDistance(workout.targetDistanceMetres)}</span>
          </>
        )}
        <span>·</span>
        <span className="capitalize">{workout.effortLevel}</span>
      </div>

      {/* Expanded description */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/10 text-gray-300 whitespace-pre-line leading-relaxed text-xs">
          {workout.description}
        </div>
      )}
    </button>
  )
}

function DayCard({ day, dayName, isMobileCollapsed }: {
  day: PlannedDayData
  dayName: string
  isMobileCollapsed: boolean
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleWorkout(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dateObj = new Date(day.date)
  const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div
      className={`rounded-xl border flex flex-col ${
        day.isToday
          ? 'border-orange-500/50 ring-1 ring-orange-500/30 bg-gray-800/60'
          : 'border-gray-800 bg-gray-800/30'
      }`}
    >
      {/* Day header */}
      <div className={`px-3 py-2 border-b border-gray-800 flex items-center justify-between ${
        day.isToday ? 'bg-orange-500/10' : ''
      }`}>
        <div>
          <span className={`text-xs font-bold ${day.isToday ? 'text-orange-400' : 'text-gray-300'}`}>
            {dayName}
          </span>
          <span className="text-gray-500 text-xs ml-1.5">{dateStr}</span>
        </div>
        {day.isToday && (
          <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-1.5 py-0.5">
            Today
          </span>
        )}
      </div>

      {/* Content */}
      {!isMobileCollapsed && (
        <div className="p-2 space-y-2 flex-1">
          {day.isRest ? (
            <div className="rounded-lg border border-gray-700/50 bg-gray-700/20 p-2.5 text-center">
              <span className="text-gray-500 text-xs font-medium">REST</span>
            </div>
          ) : (
            day.workouts.map(wk => (
              <WorkoutCard
                key={wk.id}
                workout={wk}
                completed={day.completedSessionIds.length > 0}
                expanded={expandedIds.has(wk.id)}
                onToggle={() => toggleWorkout(wk.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan] = useState<WeekPlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // On mobile: which day index is expanded (default to today)
  const [mobileExpanded, setMobileExpanded] = useState<number | null>(null)

  const fetchPlan = useCallback(async (offset: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/plan?week=${offset}`)
      if (!res.ok) throw new Error('Failed to fetch plan')
      const data: WeekPlanData = await res.json()
      setPlan(data)
      // Default mobile expanded = today
      const todayIdx = data.days.findIndex(d => d.isToday)
      setMobileExpanded(todayIdx >= 0 ? todayIdx : 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlan(weekOffset)
  }, [weekOffset, fetchPlan])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Training Plan</h1>
          {plan && (
            <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${PHASE_COLOURS[plan.phase]}`}>
              {plan.phase} Phase
            </span>
          )}
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-400 min-w-[140px] text-center">
            {plan ? weekLabel(plan.weekStart) : '—'}
          </span>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 p-4 text-sm">
          {error}
        </div>
      )}

      {/* Desktop grid — 7 columns */}
      {plan && !loading && (
        <>
          <div className="hidden md:grid md:grid-cols-7 gap-2">
            {plan.days.map((day, i) => (
              <DayCard key={day.date} day={day} dayName={DAY_NAMES[i]} isMobileCollapsed={false} />
            ))}
          </div>

          {/* Mobile — stacked, only expanded day shows workouts */}
          <div className="md:hidden space-y-2">
            {plan.days.map((day, i) => {
              const isExpanded = mobileExpanded === i
              return (
                <div key={day.date}>
                  {/* Tap the day header to expand */}
                  <button
                    className="w-full"
                    onClick={() => setMobileExpanded(isExpanded ? null : i)}
                  >
                    <div
                      className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                        day.isToday
                          ? 'border-orange-500/50 bg-orange-500/10'
                          : isExpanded
                          ? 'border-gray-700 bg-gray-800/60'
                          : 'border-gray-800 bg-gray-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${day.isToday ? 'text-orange-400' : 'text-gray-300'}`}>
                          {DAY_NAMES[i]}
                        </span>
                        <span className="text-gray-500 text-xs">{formatDate(day.date)}</span>
                        {day.isToday && (
                          <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-1.5 py-0.5">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Discipline dots */}
                        {!day.isRest && (
                          <div className="flex gap-1">
                            {day.workouts.map(wk => (
                              <span
                                key={wk.id}
                                className={`w-2 h-2 rounded-full ${DISCIPLINE_STYLES[wk.discipline]?.dot ?? 'bg-gray-500'}`}
                              />
                            ))}
                          </div>
                        )}
                        {day.isRest && <span className="text-gray-500 text-xs">REST</span>}
                        {day.completedSessionIds.length > 0 && (
                          <span className="text-xs text-green-400">✓</span>
                        )}
                        <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-1 p-2 space-y-2 rounded-xl border border-gray-800 bg-gray-800/30">
                      <DayCard day={day} dayName={DAY_NAMES[i]} isMobileCollapsed={false} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
