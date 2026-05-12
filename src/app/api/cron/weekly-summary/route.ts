import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { generateWeeklySummary } from '@/lib/coaching'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const summary = await generateWeeklySummary()
  return NextResponse.json(summary)
}
