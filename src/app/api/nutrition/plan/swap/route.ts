import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { config } from '@/lib/config'
import { getNextRace } from '@/lib/races'
import { currentPhaseFromWeeks, weeksToRaceFromDate } from '@/lib/config'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SLOT_CALORIE_PCT: Record<string, number> = {
  breakfast: 0.25,
  morningSnack: 0.09,
  lunch: 0.30,
  afternoonSnack: 0.09,
  dinner: 0.30,
  eveningSnack: 0.07,
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { slot, currentTitle } = body as { slot: string; currentTitle: string }

  if (!slot || !currentTitle) {
    return NextResponse.json({ error: 'slot and currentTitle are required' }, { status: 400 })
  }

  const profile = await prisma.nutritionProfile.findUnique({ where: { userId: session.userId } })
  const calorieGoal = profile?.calorieGoal ?? 3000
  const diet = profile?.diet ?? 'none'
  const intolerances = profile?.intolerances ?? ''

  const nextRace = await getNextRace(session.userId)
  const phase = nextRace ? currentPhaseFromWeeks(weeksToRaceFromDate(nextRace.date)) : 'Base'

  const slotCalories = Math.round(calorieGoal * (SLOT_CALORIE_PCT[slot] ?? 0.20))

  const phaseGuidance: Record<string, string> = {
    Peak: 'high carb (60% carbs)',
    'Race Week': 'carb-loading (65% carbs)',
    Build: 'balanced (50% carbs, 30% protein)',
    Taper: 'reduced calories (50% carbs, 30% protein)',
  }
  const guidance = phaseGuidance[phase] ?? 'balanced'
  const dietNote = diet !== 'none' ? ` Diet: ${diet}.` : ''
  const intoleranceNote = intolerances ? ` Avoid intolerances: ${intolerances}.` : ''

  const prompt = `Suggest 3 alternative ${slot} meals for a triathlete in ${phase} phase (${guidance}), ~${slotCalories} kcal each.
Avoid: ${currentTitle}.${dietNote}${intoleranceNote}
Specific recipe names (not generic). Output ONLY 3 CSV rows, no header, no markdown:
title,cal,pro,carb,fat`

  try {
    const client = new Anthropic({ apiKey: config.anthropicApiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const options = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map(line => {
        // Split from right: last 4 comma-separated values are cal,pro,carb,fat
        // Everything before is the title (may contain commas)
        const parts = line.split(',')
        if (parts.length < 5) return null
        const [fat, carb, pro, cal, ...titleParts] = [...parts].reverse()
        const title = titleParts.reverse().join(',').trim()
        return {
          title,
          calories: Math.round(Number(cal) || 0),
          proteinG: Math.round(Number(pro) || 0),
          carbsG: Math.round(Number(carb) || 0),
          fatG: Math.round(Number(fat) || 0),
        }
      })
      .filter((o): o is NonNullable<typeof o> => o !== null && o.title.length > 0)

    return NextResponse.json({ options })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Swap generation failed:', msg)
    return NextResponse.json({ error: 'Failed to generate alternatives' }, { status: 500 })
  }
}
