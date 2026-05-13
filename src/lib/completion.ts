import { generateWeekPlan, SessionLike } from './plan'

export interface WeekCompletion {
  weekLabel: string    // "12 May"
  weekStart: Date
  planned: number      // total planned sessions that week
  completed: number    // how many were matched by actual sessions
  rate: number         // 0–100 percentage
  byDiscipline: {
    swim: { planned: number; completed: number }
    bike: { planned: number; completed: number }
    run: { planned: number; completed: number }
    gym: { planned: number; completed: number }
  }
}

export function calculateCompletion(
  sessions: { id: string; date: Date | string; discipline: string }[],
  weeksBack: number
): WeekCompletion[] {
  const results: WeekCompletion[] = []

  // Only count past weeks (offset -weeksBack to -1; not 0 = current week)
  for (let offset = -weeksBack; offset <= -1; offset++) {
    const weekPlan = generateWeekPlan(offset, sessions as SessionLike[])

    let planned = 0
    let completed = 0
    const byDiscipline = {
      swim: { planned: 0, completed: 0 },
      bike: { planned: 0, completed: 0 },
      run: { planned: 0, completed: 0 },
      gym: { planned: 0, completed: 0 },
    }

    for (const day of weekPlan.days) {
      if (day.isRest) continue
      for (const workout of day.workouts) {
        const disc = workout.discipline as keyof typeof byDiscipline
        planned++
        if (disc in byDiscipline) byDiscipline[disc].planned++
        if (day.completedSessionIds.length > 0) {
          completed++
          if (disc in byDiscipline) byDiscipline[disc].completed++
        }
      }
    }

    const rate = planned === 0 ? 0 : Math.round((completed / planned) * 100)

    results.push({
      weekLabel: weekPlan.weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      weekStart: weekPlan.weekStart,
      planned,
      completed,
      rate,
      byDiscipline,
    })
  }

  return results
}
