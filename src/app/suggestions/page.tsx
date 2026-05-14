import { prisma } from '@/lib/db'
import { runRules } from '@/lib/rules'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { weeksToRaceFromDate, weeklyTargetsForRace } from '@/lib/config'
import { getNextRace } from '@/lib/races'
import AlertBanner from '@/components/AlertBanner'
import CoachingCard from '@/components/CoachingCard'
import TargetExplainer from '@/components/TargetExplainer'
import type { CoachingSummaryContent } from '@/lib/coaching'

async function getSuggestionData(userId: string) {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const [sessions, nextRace] = await Promise.all([
    prisma.session.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 100 }),
    getNextRace(userId),
  ])

  function weekVol(from: Date, to: Date) {
    return ['swim', 'bike', 'run'].reduce((acc, d) => ({
      ...acc,
      [d]: sessions.filter(s => s.discipline === d && s.date >= from && s.date < to)
        .reduce((sum, s) => sum + s.distanceMetres, 0),
    }), { swim: 0, bike: 0, run: 0 })
  }

  const weeksToRace = nextRace ? weeksToRaceFromDate(nextRace.date) : 0

  const alerts = runRules({
    sessions: sessions.map(s => ({ ...s, date: s.date })),
    weeksToRace,
    currentWeekVolume: weekVol(weekStart, now),
    lastWeekVolume: weekVol(lastWeekStart, weekStart),
  })

  const latestSummary = await prisma.coachingSummary.findFirst({ where: { userId }, orderBy: { generatedAt: 'desc' } })
  const summaryContent = latestSummary
    ? { ...(JSON.parse(latestSummary.content) as CoachingSummaryContent), generatedAt: latestSummary.generatedAt.toISOString() }
    : null

  // Per-discipline stats
  const weeklyTargets = weeklyTargetsForRace(nextRace?.raceType ?? '70.3', nextRace?.crossTraining ?? false)
  const discStats = ['swim', 'bike', 'run'].map(d => {
    const disc = sessions.filter(s => s.discipline === d)
    const thisWeek = sessions.filter(s => s.discipline === d && s.date >= weekStart)
    return {
      discipline: d,
      totalSessions: disc.length,
      thisWeekKm: thisWeek.reduce((sum, s) => sum + s.distanceMetres, 0) / 1000,
      weeklyTargetKm: weeklyTargets[d as keyof typeof weeklyTargets] / 1000,
    }
  })

  return { alerts, summaryContent, discStats }
}

export default async function SuggestionsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const { alerts, summaryContent, discStats } = await getSuggestionData(session.userId)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Coaching</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">Alerts</h2>
        {alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
      </section>

      <CoachingCard summary={summaryContent} />

      <TargetExplainer />

      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-2">This week by discipline</h2>
        <div className="grid grid-cols-3 gap-3">
          {discStats.map(d => (
            <div key={d.discipline} className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
              <p className="text-xs text-gray-400 capitalize mb-1">{d.discipline}</p>
              <p className="text-lg font-bold text-white">{d.thisWeekKm.toFixed(1)}<span className="text-xs text-gray-500">km</span></p>
              <p className="text-xs text-gray-600">target {d.weeklyTargetKm.toFixed(0)}km</p>
              <p className="text-xs text-gray-500 mt-1">{d.totalSessions} sessions total</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
