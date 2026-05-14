import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculatePBs } from '@/lib/pbs'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.session.findMany({
    where: { userId: session.userId },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      discipline: true,
      date: true,
      durationSecs: true,
      distanceMetres: true,
    },
  })

  const pbs = calculatePBs(sessions)
  return NextResponse.json(pbs)
}
