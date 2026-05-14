import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authSession = await getSessionFromRequest(req)
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await prisma.session.findUnique({ where: { id: params.id, userId: authSession.userId } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(session)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authSession = await getSessionFromRequest(req)
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await prisma.session.findUnique({ where: { id: params.id, userId: authSession.userId } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.source !== 'manual' && session.source !== 'import') {
    return NextResponse.json(
      { error: `Sessions from ${session.source} cannot be edited. Only manual or imported sessions are editable.` },
      { status: 400 }
    )
  }

  const body = await req.json()
  const {
    discipline, date, durationSecs, distanceMetres,
    avgHeartRate, perceivedEffort, notes,
  } = body

  const update: Record<string, unknown> = {}

  if (discipline !== undefined) update.discipline = discipline

  if (date !== undefined) {
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    update.date = parsed
  }

  if (durationSecs !== undefined) {
    if (typeof durationSecs !== 'number' || durationSecs <= 0) {
      return NextResponse.json({ error: 'durationSecs must be a positive number' }, { status: 400 })
    }
    update.durationSecs = durationSecs
  }

  if (distanceMetres !== undefined) {
    if (typeof distanceMetres !== 'number' || distanceMetres <= 0) {
      return NextResponse.json({ error: 'distanceMetres must be a positive number' }, { status: 400 })
    }
    update.distanceMetres = distanceMetres
  }

  if (avgHeartRate !== undefined) {
    if (avgHeartRate !== null && (typeof avgHeartRate !== 'number' || avgHeartRate <= 0)) {
      return NextResponse.json({ error: 'avgHeartRate must be a positive number' }, { status: 400 })
    }
    update.avgHeartRate = avgHeartRate
  }

  if (perceivedEffort !== undefined) {
    if (perceivedEffort !== null && (typeof perceivedEffort !== 'number' || perceivedEffort <= 0)) {
      return NextResponse.json({ error: 'perceivedEffort must be a positive number' }, { status: 400 })
    }
    update.perceivedEffort = perceivedEffort
  }

  if (notes !== undefined) update.notes = notes

  const updated = await prisma.session.update({ where: { id: params.id }, data: update })
  return NextResponse.json(updated)
}
