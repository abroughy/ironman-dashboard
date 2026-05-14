import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { RACE_CONFIGS } from '@/lib/raceConfig'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const races = await prisma.race.findMany({
    where: { userId: session.userId },
    orderBy: { date: 'asc' },
  })
  return NextResponse.json(races)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, raceType, date, priority = 'A', notes, crossTraining = false, goalTime = null, currentTime = null } = await request.json()
  if (!name || !raceType || !date) return NextResponse.json({ error: 'name, raceType and date are required' }, { status: 400 })
  if (!RACE_CONFIGS[raceType as keyof typeof RACE_CONFIGS]) return NextResponse.json({ error: 'Invalid race type' }, { status: 400 })
  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  const race = await prisma.race.create({
    data: {
      userId: session.userId,
      name,
      raceType,
      date: parsedDate,
      priority,
      notes: notes ?? null,
      crossTraining: Boolean(crossTraining),
      goalTime: goalTime ? Number(goalTime) : null,
      currentTime: currentTime ? Number(currentTime) : null,
    },
  })
  return NextResponse.json(race, { status: 201 })
}
