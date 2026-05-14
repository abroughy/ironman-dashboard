import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const discipline = params.get('discipline')
  const from = params.get('from')
  const to = params.get('to')
  const page = parseInt(params.get('page') ?? '1')
  const pageSize = 20

  const where = {
    userId: session.userId,
    ...(discipline && discipline !== 'all' ? { discipline } : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  }

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, discipline: true, date: true, durationSecs: true,
        distanceMetres: true, avgHeartRate: true, perceivedEffort: true,
        notes: true, source: true, stravaActivityId: true, createdAt: true,
      },
    }),
    prisma.session.count({ where }),
  ])

  return NextResponse.json({ sessions, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    discipline: string
    date: string
    durationSecs: number
    distanceMetres: number
    avgHeartRate?: number
    perceivedEffort?: number
    notes?: string
    source?: string
  }

  if (!body.discipline || !body.date || !body.durationSecs || !body.distanceMetres) {
    return NextResponse.json({ error: 'Missing required fields: discipline, date, durationSecs, distanceMetres' }, { status: 400 })
  }

  const date = new Date(body.date)
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const created = await prisma.session.create({
    data: {
      userId: session.userId,
      discipline: body.discipline,
      date,
      durationSecs: body.durationSecs,
      distanceMetres: body.distanceMetres,
      avgHeartRate: body.avgHeartRate ?? null,
      perceivedEffort: body.perceivedEffort ?? null,
      notes: body.notes ?? null,
      source: body.source ?? 'manual',
    },
  })

  return NextResponse.json(created, { status: 201 })
}
