import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { getRaceConfig } from '@/lib/raceConfig'
import { config } from '@/lib/config'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const race = await prisma.race.findUnique({ where: { id } })
  if (!race || race.userId !== session.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!race.goalTime || !race.currentTime) return NextResponse.json({ error: 'Set a goal time and current time first' }, { status: 400 })

  const raceConfig = getRaceConfig(race.raceType)
  const weeksAvailable = Math.max(1, Math.ceil((race.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)))
  const monthsAvailable = Math.ceil(weeksAvailable / 4.33)
  const improvementSeconds = race.currentTime - race.goalTime
  const improvementPct = ((improvementSeconds / race.currentTime) * 100).toFixed(1)

  // Generate monthly milestone dates between now and race date
  const milestoneMonths: string[] = []
  const now = new Date()
  for (let m = 1; m <= monthsAvailable; m++) {
    const d = new Date(now)
    d.setMonth(d.getMonth() + m)
    if (d < race.date) milestoneMonths.push(d.toISOString().split('T')[0])
  }

  const prompt = `You are an expert endurance coach with deep knowledge of exercise physiology and sports science.

An athlete wants to go from ${formatTime(race.currentTime)} to ${formatTime(race.goalTime)} in a ${raceConfig.label} (${race.name}).
- Improvement needed: ${formatTime(improvementSeconds)} (${improvementPct}% faster)
- Time available: ${monthsAvailable} months (${weeksAvailable} weeks)
- Race date: ${race.date.toISOString().split('T')[0]}
- Milestone target dates: ${milestoneMonths.join(', ')}

Using real exercise physiology principles (VO2max adaptation rates, lactate threshold training, neuromuscular efficiency, typical endurance athlete progression curves), provide:

1. A "realism" rating: "achievable" | "challenging" | "very ambitious" | "unrealistic" — and a one-sentence reason
2. For each milestone date above, a realistic intermediate target time in seconds and a specific 2-sentence training focus

Important physiological constraints to respect:
- Aerobic base adaptations take 4–8 weeks to manifest
- VO2max improvements plateau after 6–12 months of training
- Typical well-trained recreational runner improvement: 1–3% per month early on, slowing later
- Taper in final 2–3 weeks reduces time but doesn't improve fitness
- For triathlon times, factor in swim/bike fatigue affecting run split

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "realism": "achievable",
  "realismNote": "One sentence explanation",
  "milestones": [
    {
      "date": "YYYY-MM-DD",
      "targetSeconds": 8400,
      "focus": "Two sentences on training focus and why it drives improvement at this stage."
    }
  ]
}

The milestones array must have exactly ${milestoneMonths.length} entries, one per date: ${milestoneMonths.join(', ')}.
The final milestone target should be close to but not necessarily exactly the goal time — be realistic.`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'

  // Parse and enrich with formatted times
  const raw = JSON.parse(text)
  const goalPlan = {
    ...raw,
    goalTime: race.goalTime,
    currentTime: race.currentTime,
    generatedAt: new Date().toISOString(),
    milestones: raw.milestones.map((m: { date: string; targetSeconds: number; focus: string }) => ({
      ...m,
      targetFormatted: formatTime(m.targetSeconds),
    })),
  }

  // Cache on the race record
  await prisma.race.update({
    where: { id },
    data: { milestones: JSON.stringify(goalPlan) },
  })

  return NextResponse.json(goalPlan)
}
