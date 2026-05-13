import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculatePBs } from '@/lib/pbs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sessions = await prisma.session.findMany({
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
