import { describe, it, expect } from 'vitest'
import { runRules, type RuleInput, type Alert } from '@/lib/rules'

function makeSession(overrides: Partial<RuleInput['sessions'][0]>): RuleInput['sessions'][0] {
  return {
    discipline: 'run',
    date: new Date(),
    durationSecs: 3600,
    distanceMetres: 10000,
    perceivedEffort: 5,
    source: 'strava',
    ...overrides,
  }
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

describe('runRules', () => {
  it('returns green when no issues', () => {
    const alerts = runRules({
      sessions: [
        makeSession({ discipline: 'swim', date: daysAgo(2) }),
        makeSession({ discipline: 'bike', date: daysAgo(4) }),
        makeSession({ discipline: 'run', date: daysAgo(1) }),
      ],
      weeksToRace: 20,
      currentWeekVolume: { swim: 4000, bike: 100000, run: 25000 },
      lastWeekVolume: { swim: 4000, bike: 100000, run: 25000 },
    })
    expect(alerts.some(a => a.severity === 'green')).toBe(true)
    expect(alerts.every(a => a.severity !== 'red' && a.severity !== 'amber')).toBe(true)
  })

  it('flags discipline neglect when no swim in 11 days', () => {
    const alerts = runRules({
      sessions: [makeSession({ discipline: 'swim', date: daysAgo(11) })],
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const neglect = alerts.find(a => a.rule === 'discipline_neglect')
    expect(neglect).toBeDefined()
    expect(neglect?.severity).toBe('amber')
    expect(neglect?.message).toContain('swim')
  })

  it('flags overtraining for 3+ consecutive hard efforts', () => {
    const alerts = runRules({
      sessions: [
        makeSession({ date: daysAgo(1), perceivedEffort: 8 }),
        makeSession({ date: daysAgo(2), perceivedEffort: 9 }),
        makeSession({ date: daysAgo(3), perceivedEffort: 7 }),
      ],
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const overtraining = alerts.find(a => a.rule === 'overtraining')
    expect(overtraining).toBeDefined()
    expect(overtraining?.severity).toBe('red')
  })

  it('flags rest deficit when all 7 days have sessions', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSession({ date: daysAgo(i) })
    )
    const alerts = runRules({
      sessions,
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const rest = alerts.find(a => a.rule === 'rest_deficit')
    expect(rest).toBeDefined()
    expect(rest?.severity).toBe('amber')
  })

  it('flags volume drop when current week is 31% below last week', () => {
    const alerts = runRules({
      sessions: [],
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 69000, run: 0 },
      lastWeekVolume: { swim: 0, bike: 100000, run: 0 },
    })
    const drop = alerts.find(a => a.rule === 'volume_drop')
    expect(drop).toBeDefined()
    expect(drop?.message).toContain('bike')
  })

  it('flags taper reminder when 5 weeks to race', () => {
    const alerts = runRules({
      sessions: [],
      weeksToRace: 5,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const taper = alerts.find(a => a.rule === 'taper_reminder')
    expect(taper).toBeDefined()
    expect(taper?.severity).toBe('phase')
  })
})
