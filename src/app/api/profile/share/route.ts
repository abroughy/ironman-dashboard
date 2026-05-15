import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { share?: boolean }
  if (typeof body.share !== 'boolean') {
    return NextResponse.json({ error: 'share must be boolean' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { shareWithGroup: body.share },
  })

  return NextResponse.json({ ok: true, shareWithGroup: body.share })
}
