import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateTrainingLoad } from '@/lib/trainingLoad'

export const dynamic = 'force-dynamic'

export async function GET() {
  const since = new Date()
  since.setDate(since.getDate() - 84)

  const sessions = await prisma.session.findMany({
    where: { date: { gte: since } },
    select: { date: true, durationSecs: true, perceivedEffort: true },
  })

  const points = calculateTrainingLoad(sessions)
  return NextResponse.json(points)
}
