import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { displayName?: string }
  const displayName = (body.displayName ?? '').trim()

  if (!displayName || displayName.length > 50) {
    return NextResponse.json({ error: 'Display name must be 1–50 characters' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { displayName },
  })

  return NextResponse.json({ ok: true })
}
