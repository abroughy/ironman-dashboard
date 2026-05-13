export interface TrainingLoadPoint {
  date: string // ISO date string YYYY-MM-DD
  atl: number
  ctl: number
  form: number
  dailyLoad: number
}

function sessionLoad(session: { durationSecs: number; perceivedEffort: number | null }): number {
  const hours = session.durationSecs / 3600
  const intensity = session.perceivedEffort ?? 5
  return hours * intensity * 10
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function calculateTrainingLoad(
  sessions: { date: Date | string; durationSecs: number; perceivedEffort: number | null }[]
): TrainingLoadPoint[] {
  // Build a map of date string -> daily load
  const loadByDay = new Map<string, number>()
  for (const s of sessions) {
    const d = typeof s.date === 'string' ? new Date(s.date) : s.date
    const key = toDateStr(d)
    loadByDay.set(key, (loadByDay.get(key) ?? 0) + sessionLoad(s))
  }

  // Generate the last 84 days
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const points: TrainingLoadPoint[] = []
  let atl = 0
  let ctl = 0

  // Start from 84 days ago
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 83)

  for (let i = 0; i < 84; i++) {
    const day = new Date(startDate)
    day.setDate(startDate.getDate() + i)
    const key = toDateStr(day)
    const dailyLoad = loadByDay.get(key) ?? 0

    atl = atl * (1 - 1 / 7) + dailyLoad * (1 / 7)
    ctl = ctl * (1 - 1 / 42) + dailyLoad * (1 / 42)
    const form = ctl - atl

    points.push({ date: key, atl, ctl, form, dailyLoad })
  }

  return points
}
