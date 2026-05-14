import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculatePBs } from '@/lib/pbs'
import { getSessionFromRequest } from '@/lib/auth'
import { getNextRace } from '@/lib/races'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [sessions, nextRace] = await Promise.all([
    prisma.session.findMany({
      where: { userId: session.userId },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        discipline: true,
        date: true,
        durationSecs: true,
        distanceMetres: true,
      },
    }),
    getNextRace(session.userId),
  ])

  const raceType = nextRace?.raceType ?? '70.3'
  const pbs = calculatePBs(sessions, raceType)
  return NextResponse.json(pbs)
}
