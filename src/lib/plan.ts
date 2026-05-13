import { WORKOUTS, Workout } from './workouts'
import { weeksToRace } from './config'

export interface PlannedDay {
  date: Date
  workouts: Workout[]
  isToday: boolean
  isRest: boolean
  completedSessionIds: string[]
}

export interface WeekPlan {
  weekStart: Date   // Monday
  days: PlannedDay[] // 7 days Mon–Sun
  weekNumber: number // weeks since training start (approx)
  phase: 'Build' | 'Peak' | 'Taper'
}

// Session shape we need from the DB (matches Prisma Session)
export interface SessionLike {
  id: string
  discipline: string
  date: Date | string
}

// ─── helpers ────────────────────────────────────────────────────────────────

function w(id: string): Workout {
  const wk = WORKOUTS[id]
  if (!wk) throw new Error(`Unknown workout id: ${id}`)
  return wk
}

/** Monday of the ISO week containing `date` */
function mondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/** Add `days` days to a date (returns new Date) */
function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// ─── weekly templates ────────────────────────────────────────────────────────

type DayTemplate = string[] // workout ids; empty = REST

function buildTemplate(weekNum: number): DayTemplate[] {
  // Mon=0 … Sun=6
  const techSwims = ['swim-catch-up', 'swim-fingertip-drag', 'swim-fist-drill', 'swim-kick-drill']
  const endSwims = ['swim-pull-buoy', 'swim-bilateral', 'swim-progressive', 'swim-endurance']
  // Alternate between brick and intervals each week
  const wedSession = weekNum % 2 === 0 ? ['brick-bike', 'brick-run'] : ['run-intervals']
  return [
    [techSwims[weekNum % techSwims.length]],                         // Mon — swim technique
    [endSwims[weekNum % endSwims.length]],                           // Tue — swim endurance (5-a-side evening)
    wedSession,                                                      // Wed — brick or intervals
    ['bike-hiit', 'gym-legs'],                                       // Thu — bike HIIT + gym
    [weekNum % 2 === 0 ? 'gym-core' : 'gym-legs', 'run-recovery'],  // Fri — gym + recovery run
    ['bike-long'],                                                   // Sat — long ride
    ['run-long'],                                                    // Sun — long run
  ]
}

function peakTemplate(weekNum: number): DayTemplate[] {
  const progSwims = ['swim-progressive', 'swim-endurance']
  return [
    [progSwims[weekNum % progSwims.length]],   // Mon — swim
    ['swim-endurance'],                        // Tue — swim endurance (5-a-side evening)
    ['brick-bike', 'brick-run'],               // Wed — brick every week in peak
    ['bike-hiit', 'gym-legs'],                 // Thu — bike HIIT + gym
    ['run-recovery', 'gym-core'],              // Fri — recovery + core
    ['bike-long'],                             // Sat — long ride
    ['run-long'],                              // Sun — long run
  ]
}

function taperTemplate(): DayTemplate[] {
  return [
    ['swim-bilateral'],    // Mon
    ['bike-endurance'],    // Tue
    ['run-easy'],          // Wed
    ['swim-pull-buoy'],    // Thu
    [],                    // Fri REST
    ['bike-endurance'],    // Sat
    ['run-easy'],          // Sun
  ]
}

// ─── main export ─────────────────────────────────────────────────────────────

export function generateWeekPlan(weekOffset: number, sessions: SessionLike[]): WeekPlan {
  const now = new Date()
  const thisMonday = mondayOf(now)
  const weekStart = addDays(thisMonday, weekOffset * 7)

  // Approximate week number since 52 weeks before race (training start)
  const weeksLeft = weeksToRace()
  // weekNumber: 0 = first week of training, increases each week
  const weekNumber = Math.max(0, 52 - weeksLeft - weekOffset)

  let phase: 'Build' | 'Peak' | 'Taper'
  let template: DayTemplate[]

  if (weeksLeft - weekOffset > 12) {
    phase = 'Build'
    template = buildTemplate(weekNumber)
  } else if (weeksLeft - weekOffset > 6) {
    phase = 'Peak'
    template = peakTemplate(weekNumber)
  } else {
    phase = 'Taper'
    template = taperTemplate()
  }

  const days: PlannedDay[] = template.map((workoutIds, dayIndex) => {
    const date = addDays(weekStart, dayIndex)

    const workouts: Workout[] = workoutIds.map(id => w(id))
    const isRest = workoutIds.length === 0

    // Match completed sessions: same day (±12h window) and discipline match
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const disciplines = new Set(workouts.map(wk => wk.discipline))

    const completedSessionIds = sessions
      .filter(s => {
        const sd = typeof s.date === 'string' ? new Date(s.date) : s.date
        return sd >= dayStart && sd <= dayEnd && disciplines.has(s.discipline as Workout['discipline'])
      })
      .map(s => s.id)

    return {
      date,
      workouts,
      isToday: sameDay(date, now),
      isRest,
      completedSessionIds,
    }
  })

  return { weekStart, days, weekNumber, phase }
}
