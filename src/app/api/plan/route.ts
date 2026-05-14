import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateWeekPlan } from '@/lib/plan'
import { getSessionFromRequest } from '@/lib/auth'
import { getNextRace } from '@/lib/races'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekParam = request.nextUrl.searchParams.get('week')
  const weekOffset = parseInt(weekParam ?? '0', 10)

  if (isNaN(weekOffset)) {
    return NextResponse.json({ error: 'Invalid week parameter' }, { status: 400 })
  }

  // Fetch sessions for the relevant week ±3 days to cover edge cases
  const now = new Date()
  // Monday of target week
  const day = now.getDay()
  const mondayDiff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(monday.getDate() + mondayDiff + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  const from = new Date(monday)
  from.setDate(from.getDate() - 3)

  const to = new Date(monday)
  to.setDate(to.getDate() + 9) // 7 days + 3 days buffer

  const [sessions, nextRace] = await Promise.all([
    prisma.session.findMany({
      where: {
        userId: session.userId,
        date: { gte: from, lte: to },
      },
      select: { id: true, discipline: true, date: true },
    }),
    getNextRace(session.userId),
  ])

  const raceType = nextRace?.raceType ?? '70.3'
  const plan = generateWeekPlan(weekOffset, sessions, raceType, nextRace?.date)

  // Serialize dates to ISO strings for JSON transport
  const serialised = {
    weekStart: plan.weekStart.toISOString(),
    weekNumber: plan.weekNumber,
    phase: plan.phase,
    days: plan.days.map(d => ({
      date: d.date.toISOString(),
      isToday: d.isToday,
      isRest: d.isRest,
      completedSessionIds: d.completedSessionIds,
      workouts: d.workouts,
    })),
  }

  return NextResponse.json(serialised)
}
