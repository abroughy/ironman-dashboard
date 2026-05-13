import { prisma } from '@/lib/db'
import { calculateProjection } from '@/lib/projection'
import { calculateWeeklyVolume } from '@/lib/weeklyVolume'

export const dynamic = 'force-dynamic'
import DisciplineChart from '@/components/DisciplineChart'
import FinishProjection from '@/components/FinishProjection'
import WeeklyVolumeChart from '@/components/WeeklyVolumeChart'

async function getSessionsForProgress() {
  return prisma.session.findMany({
    orderBy: { date: 'asc' },
    select: { discipline: true, date: true, durationSecs: true, distanceMetres: true },
  })
}

type S = { discipline: string; date: Date; durationSecs: number; distanceMetres: number }

function swimDataPoints(sessions: S[]) {
  return sessions
    .filter(s => s.discipline === 'swim' && s.distanceMetres > 0)
    .map(s => ({
      date: s.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      primary: parseFloat(((s.durationSecs / s.distanceMetres) * 100 / 60).toFixed(2)),
    }))
}

function bikeDataPoints(sessions: S[]) {
  return sessions
    .filter(s => s.discipline === 'bike' && s.durationSecs > 0)
    .map(s => ({
      date: s.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      primary: parseFloat(((s.distanceMetres / 1000) / (s.durationSecs / 3600)).toFixed(1)),
    }))
}

function runDataPoints(sessions: S[]) {
  return sessions
    .filter(s => s.discipline === 'run' && s.distanceMetres > 0)
    .map(s => ({
      date: s.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      primary: parseFloat(((s.durationSecs / s.distanceMetres) * 1000 / 60).toFixed(2)),
    }))
}

export default async function ProgressPage() {
  const sessions = await getSessionsForProgress()

  const last8 = (disc: string) => sessions.filter(s => s.discipline === disc).slice(-8)
  const projection = calculateProjection({
    swimSessions: last8('swim'),
    bikeSessions: last8('bike'),
    runSessions: last8('run'),
  })

  const weeklyVolumeData = calculateWeeklyVolume(sessions, 12)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Progress</h1>
      <WeeklyVolumeChart data={weeklyVolumeData} />
      <FinishProjection avgMins={projection.avgMins} bestMins={projection.bestMins} />
      <DisciplineChart title="Swim — pace per 100m (min)" data={swimDataPoints(sessions)} primaryLabel="min/100m" colour="#3b82f6" />
      <DisciplineChart title="Bike — avg speed (km/h)" data={bikeDataPoints(sessions)} primaryLabel="km/h" colour="#f97316" />
      <DisciplineChart title="Run — pace per km (min)" data={runDataPoints(sessions)} primaryLabel="min/km" colour="#22c55e" />
    </div>
  )
}
