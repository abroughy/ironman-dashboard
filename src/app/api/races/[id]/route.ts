import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const race = await prisma.race.findUnique({ where: { id } })
  if (!race || race.userId !== session.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json()
  const updated = await prisma.race.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.raceType !== undefined ? { raceType: body.raceType } : {}),
      ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.crossTraining !== undefined ? { crossTraining: Boolean(body.crossTraining) } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const race = await prisma.race.findUnique({ where: { id } })
  if (!race || race.userId !== session.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.race.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
