import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function weekStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function calcScore(swimKm: number, bikeKm: number, runKm: number): number {
  return Math.round((swimKm * 1.5 + bikeKm * 0.2 + runKm * 1.0) * 10)
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = weekStart()
  const now = new Date()

  // All opted-in users + current user (to know their opt-in status)
  const [sharingUsers, currentUser] = await Promise.all([
    prisma.user.findMany({
      where: { shareWithGroup: true },
      select: { id: true, displayName: true, username: true, avatarUrl: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { shareWithGroup: true },
    }),
  ])

  // Fetch this week's sessions for all sharing users in one query
  const sessions = await prisma.session.findMany({
    where: {
      userId: { in: sharingUsers.map(u => u.id) },
      date: { gte: since, lte: now },
    },
    select: { userId: true, discipline: true, distanceMetres: true },
  })

  // Aggregate per user
  const leaderboard = sharingUsers.map(user => {
    const userSessions = sessions.filter(s => s.userId === user.id)
    const swimKm = userSessions.filter(s => s.discipline === 'swim').reduce((sum, s) => sum + s.distanceMetres, 0) / 1000
    const bikeKm = userSessions.filter(s => s.discipline === 'bike').reduce((sum, s) => sum + s.distanceMetres, 0) / 1000
    const runKm = userSessions.filter(s => s.discipline === 'run').reduce((sum, s) => sum + s.distanceMetres, 0) / 1000
    return {
      userId: user.id,
      displayName: user.displayName ?? user.username,
      avatarUrl: user.avatarUrl,
      isCurrentUser: user.id === session.userId,
      score: calcScore(swimKm, bikeKm, runKm),
      swimKm: Math.round(swimKm * 10) / 10,
      bikeKm: Math.round(bikeKm * 10) / 10,
      runKm: Math.round(runKm * 10) / 10,
    }
  }).sort((a, b) => b.score - a.score)

  return NextResponse.json({
    leaderboard,
    currentUserSharing: currentUser?.shareWithGroup ?? false,
  })
}
