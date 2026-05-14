import { prisma } from '@/lib/db'
import { weeklyTargetsForRace, weeksToRaceFromDate, currentPhaseFromWeeks } from '@/lib/config'
import { getSession } from '@/lib/auth'
import { getNextRace } from '@/lib/races'
import { getRaceConfig } from '@/lib/raceConfig'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import PhaseBanner from '@/components/PhaseBanner'
import LoadRing from '@/components/LoadRing'
import CoachingCard from '@/components/CoachingCard'
import TrainingLoadCard from '@/components/TrainingLoadCard'
import type { CoachingSummaryContent } from '@/lib/coaching'

async function getWeekVolume(userId: string) {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
  weekStart.setHours(0, 0, 0, 0)
  const sessions = await prisma.session.findMany({ where: { userId, date: { gte: weekStart } } })
  const vol = { swim: 0, bike: 0, run: 0 }
  for (const s of sessions) {
    if (s.discipline in vol) vol[s.discipline as keyof typeof vol] += s.distanceMetres
  }
  return vol
}

async function getRecentSessions(userId: string) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return prisma.session.findMany({
    where: { userId, date: { gte: sevenDaysAgo } },
    orderBy: { date: 'desc' },
    select: { id: true, discipline: true, date: true, durationSecs: true, distanceMetres: true, source: true },
  })
}

const disciplineColour = { swim: 'bg-blue-500/20 text-blue-300', bike: 'bg-orange-500/20 text-orange-300', run: 'bg-green-500/20 text-green-300' }

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [weekVol, recentSessions, stravaToken, latestSummary, nextRace] = await Promise.all([
    getWeekVolume(session.userId),
    getRecentSessions(session.userId),
    prisma.stravaToken.findUnique({ where: { userId: session.userId } }),
    prisma.coachingSummary.findFirst({ where: { userId: session.userId }, orderBy: { generatedAt: 'desc' } }),
    getNextRace(session.userId),
  ])

  const summaryContent = latestSummary
    ? { ...(JSON.parse(latestSummary.content) as CoachingSummaryContent), generatedAt: latestSummary.generatedAt.toISOString() }
    : null

  const raceType = nextRace?.raceType ?? 'fitness'
  const targets = weeklyTargetsForRace(raceType)
  const weeksLeft = nextRace ? weeksToRaceFromDate(nextRace.date) : null
  const phase = weeksLeft !== null ? currentPhaseFromWeeks(weeksLeft) : 'Build'
  const raceLabel = getRaceConfig(raceType).label

  return (
    <div className="space-y-6">
      <PhaseBanner />

      {!stravaToken && (
        <div className="bg-gray-900 rounded-xl p-4 border border-dashed border-gray-700 text-center">
          <p className="text-gray-400 text-sm mb-2">Connect Strava to sync your bike and run sessions</p>
          <a href="/api/strava/connect" className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
            Connect Strava
          </a>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This week</h2>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>{raceLabel}</span>
            <span>·</span>
            <span>{phase} phase</span>
            {weeksLeft !== null && (
              <>
                <span>·</span>
                <span>{weeksLeft}w to race</span>
              </>
            )}
            <a href="/suggestions" className="ml-1 text-orange-400/60 hover:text-orange-400 transition-colors" title="Explain my targets">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </a>
          </div>
        </div>
        <div className="bg-gray-900/60 rounded-2xl p-6 border border-white/5 flex justify-around">
          <LoadRing discipline="swim" currentMetres={weekVol.swim} targetMetres={targets.swim} />
          <LoadRing discipline="bike" currentMetres={weekVol.bike} targetMetres={targets.bike} />
          <LoadRing discipline="run" currentMetres={weekVol.run} targetMetres={targets.run} />
        </div>
      </section>

      <TrainingLoadCard />

      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent sessions</h2>
        <div className="space-y-2">
          {recentSessions.length === 0 && <p className="text-gray-500 text-sm">No sessions in the last 7 days.</p>}
          {recentSessions.map(s => (
            <div key={s.id} className="bg-gray-900/60 rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${disciplineColour[s.discipline as keyof typeof disciplineColour] ?? ''}`}>
                  {s.discipline}
                </span>
                <span className="text-sm text-gray-300">{(s.distanceMetres / 1000).toFixed(1)}km</span>
                <span className="text-sm text-gray-500">{Math.round(s.durationSecs / 60)}min</span>
              </div>
              <span className="text-xs text-gray-600">{new Date(s.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </section>

      <CoachingCard summary={summaryContent} />
    </div>
  )
}
