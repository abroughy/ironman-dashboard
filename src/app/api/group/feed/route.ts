import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface MilestoneData {
  milestones: Array<{ date: string; targetSeconds: number; targetFormatted: string; focus: string }>
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const sharingUsers = await prisma.user.findMany({
    where: { shareWithGroup: true },
    select: { id: true, displayName: true, username: true, avatarUrl: true },
  })

  const userIds = sharingUsers.map(u => u.id)
  const userMap = Object.fromEntries(sharingUsers.map(u => [u.id, u]))

  const [sessions, races] = await Promise.all([
    prisma.session.findMany({
      where: { userId: { in: userIds }, date: { gte: since } },
      orderBy: { date: 'desc' },
      select: { id: true, userId: true, discipline: true, distanceMetres: true, durationSecs: true, date: true },
    }),
    prisma.race.findMany({
      where: { userId: { in: userIds }, milestones: { not: null }, goalTime: { not: null } },
      select: { id: true, userId: true, name: true, milestones: true },
    }),
  ])

  type FeedItem =
    | { type: 'session'; userId: string; displayName: string; avatarUrl: string | null; date: string; discipline: string; distanceMetres: number; durationSecs: number }
    | { type: 'milestone'; userId: string; displayName: string; avatarUrl: string | null; date: string; raceName: string; milestoneLabel: string }

  const items: FeedItem[] = []

  // Session feed items
  for (const s of sessions) {
    const user = userMap[s.userId]
    if (!user) continue
    items.push({
      type: 'session',
      userId: s.userId,
      displayName: user.displayName ?? user.username,
      avatarUrl: user.avatarUrl,
      date: s.date.toISOString(),
      discipline: s.discipline,
      distanceMetres: s.distanceMetres,
      durationSecs: s.durationSecs,
    })
  }

  // Milestone feed items — find milestones whose target date fell in the last 30 days
  for (const race of races) {
    if (!race.milestones) continue
    try {
      const plan = JSON.parse(race.milestones) as MilestoneData
      for (const m of plan.milestones ?? []) {
        const mDate = new Date(m.date)
        if (mDate >= since && mDate <= new Date()) {
          const user = userMap[race.userId]
          if (!user) continue
          items.push({
            type: 'milestone',
            userId: race.userId,
            displayName: user.displayName ?? user.username,
            avatarUrl: user.avatarUrl,
            date: mDate.toISOString(),
            raceName: race.name,
            milestoneLabel: `${race.name} checkpoint: ${m.targetFormatted}`,
          })
        }
      }
    } catch {
      // skip malformed milestone JSON
    }
  }

  // Sort combined feed newest first
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json(items.slice(0, 50))
}
