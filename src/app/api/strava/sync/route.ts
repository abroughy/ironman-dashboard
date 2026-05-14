import { NextRequest, NextResponse } from 'next/server'
import { syncAllActivities } from '@/lib/strava'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const synced = await syncAllActivities(session.userId)
    return NextResponse.json({ synced })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
