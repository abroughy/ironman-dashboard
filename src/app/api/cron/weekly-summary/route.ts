import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { generateWeeklySummary } from '@/lib/coaching'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const summary = await generateWeeklySummary()
    return NextResponse.json(summary)
  } catch (err) {
    console.error('Weekly summary cron failed', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
