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

  const logs = await prisma.wellnessLog.findMany({
    where: { userId: session.userId, date: { gte: since } },
    orderBy: { date: 'asc' },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Recovery</h1>
      <RecoveryClient logs={logs.map(l => ({
        date: l.date.toISOString(),
        sleepHours: l.sleepHours,
        soreness: l.soreness,
        energy: l.energy,
        score: l.score,
      }))} />
    </div>
  )
}
