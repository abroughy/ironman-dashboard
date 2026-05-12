import { NextResponse } from 'next/server'
import { generateWeeklySummary } from '@/lib/coaching'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const summary = await generateWeeklySummary()
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
