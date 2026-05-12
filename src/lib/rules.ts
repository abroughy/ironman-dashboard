export type Discipline = 'swim' | 'bike' | 'run'
export type Severity = 'red' | 'amber' | 'green' | 'phase'

export interface SessionSummary {
  discipline: Discipline | string
  date: Date
  durationSecs: number
  distanceMetres: number
  perceivedEffort?: number | null
  source: string
}

export interface RuleInput {
  sessions: SessionSummary[]
  weeksToRace: number
  currentWeekVolume: Record<Discipline, number>
  lastWeekVolume: Record<Discipline, number>
}

export interface Alert {
  rule: string
  severity: Severity
  message: string
}

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)
}

export function runRules(input: RuleInput): Alert[] {
  const alerts: Alert[] = []
  const now = new Date()

  // Discipline neglect: no session of a discipline in 10+ days
  for (const disc of DISCIPLINES) {
    const last = input.sessions
      .filter(s => s.discipline === disc)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
    if (!last || daysBetween(last.date, now) >= 10) {
      alerts.push({
        rule: 'discipline_neglect',
        severity: 'amber',
        message: `No ${disc} session in ${last ? Math.floor(daysBetween(last.date, now)) : 'many'} days`,
      })
    }
  }

  // Overtraining: 3+ consecutive sessions with effort >= 7
  const hardSessions = [...input.sessions]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
  let consecutive = 0
  for (const s of hardSessions) {
    if ((s.perceivedEffort ?? 0) >= 7) {
      consecutive++
      if (consecutive >= 3) {
        alerts.push({
          rule: 'overtraining',
          severity: 'red',
          message: `${consecutive} hard sessions in a row — rest tomorrow`,
        })
        break
      }
    } else {
      break
    }
  }

  // Rest deficit: all 7 of the last 7 days have sessions
  const last7Days = new Set(
    input.sessions
      .filter(s => daysBetween(s.date, now) < 7)
      .map(s => s.date.toDateString())
  )
  if (last7Days.size >= 7) {
    alerts.push({
      rule: 'rest_deficit',
      severity: 'amber',
      message: 'No rest day in the last 7 days',
    })
  }

  // Volume drop: any discipline down >30% vs last week
  for (const disc of DISCIPLINES) {
    const curr = input.currentWeekVolume[disc]
    const prev = input.lastWeekVolume[disc]
    if (prev > 0 && curr < prev * 0.7) {
      alerts.push({
        rule: 'volume_drop',
        severity: 'amber',
        message: `${disc} volume down ${Math.round((1 - curr / prev) * 100)}% vs last week`,
      })
    }
  }

  // Taper reminder
  if (input.weeksToRace > 0 && input.weeksToRace <= 6) {
    alerts.push({
      rule: 'taper_reminder',
      severity: 'phase',
      message: `Race in ${input.weeksToRace} week${input.weeksToRace === 1 ? '' : 's'} — consider starting taper`,
    })
  }

  // Green if no red/amber
  if (!alerts.some(a => a.severity === 'red' || a.severity === 'amber')) {
    alerts.push({
      rule: 'on_track',
      severity: 'green',
      message: 'On track across all disciplines this week',
    })
  }

  return alerts
}
