import { prisma } from './db'

export interface RaceSummary {
  id: string
  name: string
  raceType: string
  date: Date
  priority: string
  notes: string | null
  crossTraining: boolean
  goalTime: number | null
  currentTime: number | null
  milestones: string | null
}

/** Returns the next upcoming race for a user (soonest future date), or null */
export async function getNextRace(userId: string): Promise<RaceSummary | null> {
  const race = await prisma.race.findFirst({
    where: { userId, date: { gte: new Date() } },
    orderBy: { date: 'asc' },
  })
  return race ?? null
}
