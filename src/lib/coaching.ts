import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { config, currentPhase, weeksToRace } from '@/lib/config'
import { runRules } from '@/lib/rules'

export interface CoachingSummaryContent {
  wentWell: string
  weakness: string
  nextFocus: string
  projectedFinish: { avg: string; best: string } | null
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

export async function generateWeeklySummary(): Promise<CoachingSummaryContent> {
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const sessions = await prisma.session.findMany({
    where: { date: { gte: fourWeeksAgo } },
    orderBy: { date: 'desc' },
  })

  // Personal bests
  const bests: Record<string, { pace: number | null; distance: number }> = {
    swim: { pace: null, distance: 0 },
    bike: { pace: null, distance: 0 },
    run: { pace: null, distance: 0 },
  }
  for (const s of sessions) {
    const disc = s.discipline as 'swim' | 'bike' | 'run'
    if (!bests[disc]) continue
    if (s.distanceMetres > bests[disc].distance) bests[disc].distance = s.distanceMetres
    if (s.distanceMetres > 0) {
      const pace = s.durationSecs / s.distanceMetres
      if (bests[disc].pace === null || pace < bests[disc].pace!) bests[disc].pace = pace
    }
  }

  // Rule alerts
  const now = new Date()
  const weekStart = startOfWeek(now)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  function weekVolume(from: Date, to: Date) {
    return { swim: 0, bike: 0, run: 0, ...Object.fromEntries(
      ['swim', 'bike', 'run'].map(d => [
        d,
        sessions
          .filter(s => s.discipline === d && s.date >= from && s.date < to)
          .reduce((sum, s) => sum + s.distanceMetres, 0),
      ])
    )} as { swim: number; bike: number; run: number }
  }

  const alerts = runRules({
    sessions: sessions.map(s => ({ ...s, date: s.date })),
    weeksToRace: weeksToRace(),
    currentWeekVolume: weekVolume(weekStart, now),
    lastWeekVolume: weekVolume(lastWeekStart, weekStart),
  })

  const alertSummary = alerts.map(a => `[${a.severity.toUpperCase()}] ${a.message}`).join('\n')
  const sessionSummary = sessions
    .slice(0, 20)
    .map(s => `${s.date.toISOString().split('T')[0]} ${s.discipline} ${(s.distanceMetres / 1000).toFixed(1)}km ${Math.round(s.durationSecs / 60)}min effort=${s.perceivedEffort ?? '?'} notes="${s.notes ?? ''}"`)
    .join('\n')

  const prompt = `You are a triathlon coach. Analyse the athlete's last 4 weeks of training and provide a structured weekly summary. Respond with valid JSON only — no markdown, no explanation.

ATHLETE CONTEXT:
- Race: Ironman 70.3 (1.9km swim, 90km bike, 21.1km run)
- Race date: September 2026 (${weeksToRace()} weeks away)
- Current phase: ${currentPhase()}

RECENT SESSIONS (newest first):
${sessionSummary}

AUTOMATED ALERTS:
${alertSummary}

PERSONAL BESTS (last 4 weeks):
- Swim: ${bests.swim.distance}m, pace ${bests.swim.pace ? (bests.swim.pace * 100).toFixed(0) + 's/100m' : 'n/a'}
- Bike: ${bests.bike.distance}m, pace ${bests.bike.pace ? (1 / bests.bike.pace * 3.6).toFixed(1) + 'km/h' : 'n/a'}
- Run: ${bests.run.distance}m, pace ${bests.run.pace ? (bests.run.pace / 60).toFixed(2) + 'min/km' : 'n/a'}

Respond with this exact JSON structure:
{
  "wentWell": "2-3 sentences on what the athlete did well this week",
  "weakness": "1-2 sentences on the main area needing attention",
  "nextFocus": "1 specific, actionable recommendation for next week",
  "projectedFinish": { "avg": "Xh XXm", "best": "Xh XXm" }
}`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  if (message.stop_reason !== 'end_turn') {
    throw new Error(`Claude stopped unexpectedly: ${message.stop_reason}`)
  }
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  let parsed: CoachingSummaryContent
  try {
    parsed = JSON.parse(text) as CoachingSummaryContent
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`)
  }

  const weekStartDate = startOfWeek(now)
  await prisma.coachingSummary.upsert({
    where: { weekStart: weekStartDate },
    update: { content: JSON.stringify(parsed), generatedAt: new Date() },
    create: { weekStart: weekStartDate, content: JSON.stringify(parsed) },
  })

  return parsed
}
