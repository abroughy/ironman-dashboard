import { NextResponse } from 'next/server'
import { syncAllActivities } from '@/lib/strava'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const synced = await syncAllActivities()
    return NextResponse.json({ synced })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
