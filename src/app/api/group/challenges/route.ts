import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const VALID_DISCIPLINES = ['swim', 'bike', 'run', 'any']

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const challenges = await prisma.groupChallenge.findMany({
    where: { endDate: { gte: now } },
    orderBy: { endDate: 'asc' },
    include: { creator: { select: { id: true, displayName: true, username: true } } },
  })

  // For each challenge, compute progress for all opted-in users
  const sharingUsers = await prisma.user.findMany({
    where: { shareWithGroup: true },
    select: { id: true, displayName: true, username: true, avatarUrl: true },
  })

  const result = await Promise.all(challenges.map(async challenge => {
    const relevantSessions = await prisma.session.findMany({
      where: {
        userId: { in: sharingUsers.map(u => u.id) },
        date: { gte: challenge.startDate, lte: challenge.endDate },
        ...(challenge.discipline !== 'any' ? { discipline: challenge.discipline } : {}),
      },
      select: { userId: true, distanceMetres: true },
    })

    const participants = sharingUsers.map(user => {
      const progressMetres = relevantSessions
        .filter(s => s.userId === user.id)
        .reduce((sum, s) => sum + s.distanceMetres, 0)
      const progressKm = Math.round((progressMetres / 1000) * 10) / 10
      const progressPct = Math.min(100, Math.round((progressKm / challenge.targetKm) * 100))
      return {
        userId: user.id,
        displayName: user.displayName ?? user.username,
        avatarUrl: user.avatarUrl,
        progressKm,
        progressPct,
        isCurrentUser: user.id === session.userId,
      }
    }).sort((a, b) => b.progressKm - a.progressKm)

    return {
      id: challenge.id,
      name: challenge.name,
      discipline: challenge.discipline,
      targetKm: challenge.targetKm,
      startDate: challenge.startDate.toISOString(),
      endDate: challenge.endDate.toISOString(),
      createdBy: challenge.createdBy,
      creatorName: challenge.creator.displayName ?? challenge.creator.username,
      participants,
    }
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    name?: string
    discipline?: string
    targetKm?: number
    startDate?: string
    endDate?: string
  }

  const name = (body.name ?? '').trim()
  const discipline = body.discipline ?? ''
  const targetKm = Number(body.targetKm)
  const startDate = body.startDate ? new Date(body.startDate) : null
  const endDate = body.endDate ? new Date(body.endDate) : null
  const now = new Date()
  const ninetyDaysOut = new Date(now)
  ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90)

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!VALID_DISCIPLINES.includes(discipline)) return NextResponse.json({ error: 'Invalid discipline' }, { status: 400 })
  if (!targetKm || targetKm <= 0) return NextResponse.json({ error: 'targetKm must be positive' }, { status: 400 })
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
  }
  if (endDate <= startDate) return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 })
  if (endDate > ninetyDaysOut) return NextResponse.json({ error: 'endDate must be within 90 days' }, { status: 400 })

  const challenge = await prisma.groupChallenge.create({
    data: { name, discipline, targetKm, startDate, endDate, createdBy: session.userId },
  })

  return NextResponse.json(challenge, { status: 201 })
}
