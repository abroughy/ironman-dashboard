import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklySummary } from '@/lib/coaching'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const summary = await generateWeeklySummary(session.userId)
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
