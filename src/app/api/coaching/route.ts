import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const latest = await prisma.coachingSummary.findFirst({
    where: { userId: session.userId },
    orderBy: { generatedAt: 'desc' },
  })
  if (!latest) return NextResponse.json(null)
  return NextResponse.json({
    ...latest,
    content: JSON.parse(latest.content),
  })
}
