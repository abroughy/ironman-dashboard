import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const challenge = await prisma.groupChallenge.findUnique({ where: { id } })
  if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!session.isAdmin && challenge.createdBy !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.groupChallenge.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
