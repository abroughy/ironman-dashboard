import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RecoveryClient from './RecoveryClient'

export const dynamic = 'force-dynamic'

export default async function RecoveryPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const since = new Date()
  since.setDate(since.getDate() - 14)
  since.setUTCHours(0, 0, 0, 0)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [logs, todayLog] = await Promise.all([
    prisma.wellnessLog.findMany({
      where: { userId: session.userId, date: { gte: since } },
      orderBy: { date: 'asc' },
    }),
    prisma.wellnessLog.findUnique({
      where: { userId_date: { userId: session.userId, date: today } },
    }),
  ])

  // Warning: 2+ consecutive poor days
  const sorted = [...logs].sort((a, b) => b.date.getTime() - a.date.getTime())
  const showWarning = sorted.length >= 2 && sorted[0].score < 45 && sorted[1].score < 45

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Recovery</h1>
      <RecoveryClient
        logs={logs.map(l => ({
          date: l.date.toISOString(),
          sleepHours: l.sleepHours,
          soreness: l.soreness,
          energy: l.energy,
          score: l.score,
        }))}
        todayLog={todayLog ? {
          sleepHours: todayLog.sleepHours,
          soreness: todayLog.soreness,
          energy: todayLog.energy,
          score: todayLog.score,
        } : null}
        showWarning={showWarning}
      />
    </div>
  )
}
