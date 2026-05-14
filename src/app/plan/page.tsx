'use client'
import { useEffect, useState, useCallback } from 'react'
import { Workout } from '@/lib/workouts'
import CompletionChart from '@/components/CompletionChart'
import { calculateCompletion, WeekCompletion } from '@/lib/completion'

// ─── types ────────────────────────────────────────────────────────────────────

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

// ─── constants ────────────────────────────────────────────────────────────────

const DISCIPLINE_STYLES: Record<string, { bg: string; border: string; text: string; dot: string; pill: string }> = {
  swim: { bg: 'bg-blue-500/15', border: 'border-blue-500/25', text: 'text-blue-300', dot: 'bg-blue-400', pill: 'bg-blue-500/20 text-blue-300' },
  bike: { bg: 'bg-orange-500/15', border: 'border-orange-500/25', text: 'text-orange-300', dot: 'bg-orange-400', pill: 'bg-orange-500/20 text-orange-300' },
  run:  { bg: 'bg-green-500/15',  border: 'border-green-500/25',  text: 'text-green-300',  dot: 'bg-green-400',  pill: 'bg-green-500/20 text-green-300'  },
  gym:  { bg: 'bg-purple-500/15', border: 'border-purple-500/25', text: 'text-purple-300', dot: 'bg-purple-400', pill: 'bg-purple-500/20 text-purple-300' },
}

const PHASE_COLOURS: Record<string, string> = {
  Build: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  Peak:  'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  Taper: 'bg-green-500/20 text-green-300 border border-green-500/30',
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)}km` : `${metres}m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function weekLabel(iso: string): string {
  return `Week of ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
}

// ─── WorkoutDetail — full-size card for the desktop detail panel ──────────────

function WorkoutDetail({ workout, completed }: { workout: Workout; completed: boolean }) {
  const [open, setOpen] = useState(true)
  const s = DISCIPLINE_STYLES[workout.discipline] ?? DISCIPLINE_STYLES.swim

  return (
    <div className={`rounded-2xl border ${s.bg} ${s.border}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 focus:outline-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
          <div className="min-w-0">
            <p className={`font-semibold ${s.text}`}>{workout.title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
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
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {completed && (
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5 font-medium">✓ Done</span>
          )}
          <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5 pt-3">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{workout.description}</p>
        </div>
      )}
    </div>
  )
}

// ─── Desktop week strip — 7 compact day tabs ──────────────────────────────────

function DayTab({
  day, dayName, selected, onClick,
}: {
  day: PlannedDayData; dayName: string; selected: boolean; onClick: () => void
}) {
  const dateObj = new Date(day.date)
  const dayNum = dateObj.getDate()
  const monthStr = dateObj.toLocaleDateString('en-GB', { month: 'short' })

  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-3 px-1 rounded-xl border transition-all focus:outline-none ${
        day.isToday && selected
          ? 'border-orange-500/60 bg-orange-500/10 ring-1 ring-orange-500/30'
          : day.isToday
          ? 'border-orange-500/40 bg-orange-500/5'
          : selected
          ? 'border-gray-600 bg-gray-800/80'
          : 'border-gray-800 bg-gray-800/20 hover:bg-gray-800/50'
      }`}
    >
      <span className={`text-xs font-semibold ${day.isToday ? 'text-orange-400' : selected ? 'text-white' : 'text-gray-400'}`}>
        {dayName}
      </span>
      <span className={`text-lg font-bold mt-0.5 ${day.isToday ? 'text-orange-300' : selected ? 'text-white' : 'text-gray-300'}`}>
        {dayNum}
      </span>
      <span className="text-xs text-gray-600 mb-2">{monthStr}</span>

      {/* Discipline dots or REST */}
      {day.isRest ? (
        <span className="text-xs text-gray-600">REST</span>
      ) : (
        <div className="flex gap-1 flex-wrap justify-center">
          {day.workouts.map(wk => (
            <span key={wk.id} className={`w-2 h-2 rounded-full ${DISCIPLINE_STYLES[wk.discipline]?.dot ?? 'bg-gray-500'}`} />
          ))}
        </div>
      )}

      {day.completedSessionIds.length > 0 && (
        <span className="text-xs text-green-400 mt-1">✓</span>
      )}
    </button>
  )
}

// ─── Desktop detail panel ─────────────────────────────────────────────────────

function DayDetail({ day }: { day: PlannedDayData; dayName: string }) {
  const dateStr = new Date(day.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="bg-gray-900/40 rounded-2xl border border-gray-800 p-6 min-h-[300px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">{dateStr}</h3>
          {day.isToday && (
            <span className="text-xs text-orange-400 font-medium">Today</span>
          )}
        </div>
        {!day.isRest && (
          <div className="flex gap-2">
            {Array.from(new Set(day.workouts.map(w => w.discipline))).map(d => {
              const s = DISCIPLINE_STYLES[d] ?? DISCIPLINE_STYLES.swim
              return (
                <span key={d} className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${s.pill}`}>{d}</span>
              )
            })}
          </div>
        )}
      </div>

      {day.isRest ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-4xl mb-3">😴</p>
          <p className="text-gray-400 font-medium">Rest day</p>
          <p className="text-gray-600 text-sm mt-1">Recovery is where fitness is built</p>
        </div>
      ) : (
        <div className="space-y-4">
          {day.workouts.map(wk => (
            <WorkoutDetail
              key={wk.id}
              workout={wk}
              completed={day.completedSessionIds.length > 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Mobile workout card (compact, expandable) ────────────────────────────────

function WorkoutCard({ workout, completed, expanded, onToggle }: {
  workout: Workout; completed: boolean; expanded: boolean; onToggle: () => void
}) {
  const s = DISCIPLINE_STYLES[workout.discipline] ?? DISCIPLINE_STYLES.swim
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left rounded-lg border p-2.5 transition-all ${s.bg} ${s.border} focus:outline-none`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
          <span className={`text-xs font-semibold truncate ${s.text}`}>{workout.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {completed && <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded px-1.5 py-0.5">✓</span>}
          <span className="text-gray-500 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-gray-400" style={{ fontSize: '11px' }}>
        <span>{workout.targetDurationMins} min</span>
        {workout.targetDistanceMetres && <><span>·</span><span>{formatDistance(workout.targetDistanceMetres)}</span></>}
        <span>·</span>
        <span className="capitalize">{workout.effortLevel}</span>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/10 text-gray-300 whitespace-pre-line leading-relaxed text-xs">
          {workout.description}
        </div>
      )}
    </button>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan] = useState<WeekPlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(0)
  const [mobileExpanded, setMobileExpanded] = useState<number | null>(null)
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set())
  const [completionData, setCompletionData] = useState<WeekCompletion[]>([])

  useEffect(() => {
    async function fetchCompletion() {
      try {
        const since = new Date()
        since.setDate(since.getDate() - 64)
        const res = await fetch(`/api/sessions?from=${since.toISOString()}&pageSize=200`)
        if (!res.ok) return
        const json = await res.json() as { sessions: { id: string; date: string; discipline: string }[] }
        setCompletionData(calculateCompletion(json.sessions, 8))
      } catch { /* ignore */ }
    }
    fetchCompletion()
  }, [])

  const fetchPlan = useCallback(async (offset: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/plan?week=${offset}`)
      if (!res.ok) throw new Error('Failed to fetch plan')
      const data: WeekPlanData = await res.json()
      setPlan(data)
      const todayIdx = data.days.findIndex(d => d.isToday)
      const defaultIdx = todayIdx >= 0 ? todayIdx : 0
      setSelectedDay(defaultIdx)
      setMobileExpanded(defaultIdx)
      setExpandedWorkouts(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlan(weekOffset) }, [weekOffset, fetchPlan])

  function toggleWorkout(id: string) {
    setExpandedWorkouts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

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
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
            ← Prev
          </button>
          <span className="text-sm text-gray-400 min-w-[140px] text-center">
            {plan ? weekLabel(plan.weekStart) : '—'}
          </span>
          <button onClick={() => setWeekOffset(o => o + 1)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
            Next →
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 p-4 text-sm">{error}</div>
      )}

      {plan && !loading && (
        <>
          {/* ── DESKTOP: week strip + detail panel ── */}
          <div className="hidden md:block space-y-3">
            {/* Day tabs strip */}
            <div className="flex gap-2">
              {plan.days.map((day, i) => (
                <DayTab
                  key={day.date}
                  day={day}
                  dayName={DAY_NAMES[i]}
                  selected={selectedDay === i}
                  onClick={() => setSelectedDay(i)}
                />
              ))}
            </div>

            {/* Detail panel */}
            <DayDetail day={plan.days[selectedDay]} dayName={DAY_NAMES[selectedDay]} />
          </div>

          {/* ── MOBILE: accordion ── */}
          <div className="md:hidden space-y-2">
            {plan.days.map((day, i) => {
              const isExpanded = mobileExpanded === i
              return (
                <div key={day.date}>
                  <button
                    className="w-full"
                    onClick={() => setMobileExpanded(isExpanded ? null : i)}
                  >
                    <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                      day.isToday ? 'border-orange-500/50 bg-orange-500/10'
                        : isExpanded ? 'border-gray-700 bg-gray-800/60'
                        : 'border-gray-800 bg-gray-800/30'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${day.isToday ? 'text-orange-400' : 'text-gray-300'}`}>{DAY_NAMES[i]}</span>
                        <span className="text-gray-500 text-xs">{formatDate(day.date)}</span>
                        {day.isToday && (
                          <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-1.5 py-0.5">Today</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!day.isRest && (
                          <div className="flex gap-1">
                            {day.workouts.map(wk => (
                              <span key={wk.id} className={`w-2 h-2 rounded-full ${DISCIPLINE_STYLES[wk.discipline]?.dot ?? 'bg-gray-500'}`} />
                            ))}
                          </div>
                        )}
                        {day.isRest && <span className="text-gray-500 text-xs">REST</span>}
                        {day.completedSessionIds.length > 0 && <span className="text-xs text-green-400">✓</span>}
                        <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-1 p-2 space-y-2 rounded-xl border border-gray-800 bg-gray-800/30">
                      {day.isRest ? (
                        <div className="text-center py-4">
                          <p className="text-gray-500 text-sm font-medium">REST</p>
                        </div>
                      ) : (
                        day.workouts.map(wk => (
                          <WorkoutCard
                            key={wk.id}
                            workout={wk}
                            completed={day.completedSessionIds.length > 0}
                            expanded={expandedWorkouts.has(wk.id)}
                            onToggle={() => toggleWorkout(wk.id)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <CompletionChart data={completionData} />
    </div>
  )
}
