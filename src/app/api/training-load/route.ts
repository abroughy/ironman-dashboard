import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateTrainingLoad } from '@/lib/trainingLoad'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date()
  since.setDate(since.getDate() - 84)

  const sessions = await prisma.session.findMany({
    where: { userId: session.userId, date: { gte: since } },
    select: { date: true, durationSecs: true, perceivedEffort: true },
  })

  const points = calculateTrainingLoad(sessions)
  return NextResponse.json(points)
}
