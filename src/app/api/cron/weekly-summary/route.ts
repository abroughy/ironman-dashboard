import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'
import { generateWeeklySummary } from '@/lib/coaching'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const users = await prisma.user.findMany({ select: { id: true } })
    for (const user of users) {
      try {
        await generateWeeklySummary(user.id)
      } catch (err) {
        console.error(`Weekly summary failed for user ${user.id}:`, err)
      }
    }
    return NextResponse.json({ ok: true, users: users.length })
  } catch (err) {
    console.error('Weekly summary cron failed', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
