import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { computeScore } from '@/lib/wellness'

export const dynamic = 'force-dynamic'

/** POST /api/wellness — upsert today's wellness log */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { sleepHours?: number; soreness?: number; energy?: number }
  const { sleepHours, soreness, energy } = body

  if (
    typeof sleepHours !== 'number' || sleepHours < 0 || sleepHours > 24 ||
    typeof soreness !== 'number' || soreness < 1 || soreness > 5 ||
    typeof energy !== 'number' || energy < 1 || energy > 5
  ) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Today at midnight UTC
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const score = computeScore(sleepHours, soreness, energy)

  const log = await prisma.wellnessLog.upsert({
    where: { userId_date: { userId: session.userId, date: today } },
    update: { sleepHours, soreness, energy, score },
    create: { userId: session.userId, date: today, sleepHours, soreness, energy, score },
  })

  return NextResponse.json(log)
}

/** GET /api/wellness?days=14 — fetch recent logs */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = parseInt(request.nextUrl.searchParams.get('days') ?? '14', 10)
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const logs = await prisma.wellnessLog.findMany({
    where: { userId: session.userId, date: { gte: since } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(logs)
}
