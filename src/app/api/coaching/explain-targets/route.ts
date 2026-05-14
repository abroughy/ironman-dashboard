import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { getNextRace } from '@/lib/races'
import { weeklyTargetsForRace, weeksToRaceFromDate, currentPhaseFromWeeks } from '@/lib/config'
import { getRaceConfig } from '@/lib/raceConfig'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { config } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gather full context
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)

  const [nextRace, allRaces, recentSessions] = await Promise.all([
    getNextRace(session.userId),
    prisma.race.findMany({
      where: { userId: session.userId },
      orderBy: { date: 'asc' },
    }),
    prisma.session.findMany({
      where: { userId: session.userId, date: { gte: weekStart } },
    }),
  ])

  const raceType = nextRace?.raceType ?? 'fitness'
  const targets = weeklyTargetsForRace(raceType)
  const raceConfig = getRaceConfig(raceType)
  const weeksLeft = nextRace ? weeksToRaceFromDate(nextRace.date) : null
  const phase = weeksLeft !== null ? currentPhaseFromWeeks(weeksLeft) : 'Build'

  const currentVol = { swim: 0, bike: 0, run: 0 }
  for (const s of recentSessions) {
    if (s.discipline in currentVol) currentVol[s.discipline as keyof typeof currentVol] += s.distanceMetres
  }

  const upcomingRaces = allRaces
    .filter(r => r.date > now)
    .map(r => `${r.name} (${getRaceConfig(r.raceType).label}, ${weeksToRaceFromDate(r.date)} weeks away, priority ${r.priority})`)
    .join('\n  - ')

  const prompt = `You are an expert triathlon and endurance coach. A user is asking why their weekly training volume targets are set the way they are, and whether they should be adjusted.

Current context:
- Next race: ${nextRace ? `${nextRace.name} — ${raceConfig.label}` : 'None (general fitness)'}
- Weeks to next race: ${weeksLeft ?? 'N/A'}
- Current training phase: ${phase}
- Weekly targets: Swim ${(targets.swim / 1000).toFixed(1)}km, Bike ${(targets.bike / 1000).toFixed(0)}km, Run ${(targets.run / 1000).toFixed(1)}km
- This week so far: Swim ${(currentVol.swim / 1000).toFixed(1)}km, Bike ${(currentVol.bike / 1000).toFixed(0)}km, Run ${(currentVol.run / 1000).toFixed(1)}km
- All upcoming races:
  - ${upcomingRaces || 'None'}

In 3–4 short paragraphs, explain:
1. Why targets are currently set at these volumes (race type, phase, proximity to race)
2. Whether these feel appropriate given the context, or if they should be higher/lower
3. One concrete suggestion for how the athlete could adjust their approach this week

Be direct, practical, and coach-like. Don't be overly positive. Use specific numbers. Keep it under 200 words total.`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  return NextResponse.json({
    explanation: text,
    context: {
      raceName: nextRace?.name ?? null,
      raceType,
      raceLabel: raceConfig.label,
      weeksLeft,
      phase,
      targets: {
        swim: targets.swim / 1000,
        bike: targets.bike / 1000,
        run: targets.run / 1000,
      },
      currentVol: {
        swim: currentVol.swim / 1000,
        bike: currentVol.bike / 1000,
        run: currentVol.run / 1000,
      },
    },
  })
}
