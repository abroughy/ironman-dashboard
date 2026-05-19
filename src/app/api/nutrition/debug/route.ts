import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { config } from '@/lib/config'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { generateMealPlan, getWeekStart } from '@/lib/nutrition'
import { getNextRace } from '@/lib/races'
import { currentPhaseFromWeeks, weeksToRaceFromDate } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checks: Record<string, unknown> = {}

  checks.anthropicKeySet = !!config.anthropicApiKey

  // Step 1: profile fetch
  try {
    const profile = await prisma.nutritionProfile.upsert({
      where: { userId: session.userId },
      update: {},
      create: { userId: session.userId, calorieGoal: 3000, diet: 'none', intolerances: '', mealsPerDay: 5 },
    })
    checks.profile = { calorieGoal: profile.calorieGoal, diet: profile.diet, mealsPerDay: profile.mealsPerDay }

    // Step 2: get next race / phase
    let phase = 'Base'
    try {
      const nextRace = await getNextRace(session.userId)
      phase = nextRace ? currentPhaseFromWeeks(weeksToRaceFromDate(nextRace.date)) : 'Base'
      checks.phase = phase
    } catch (e) {
      checks.phase = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }

    // Step 3: generate meal plan
    try {
      const content = await generateMealPlan(
        { calorieGoal: profile.calorieGoal, weightKg: profile.weightKg, diet: profile.diet, intolerances: profile.intolerances, mealsPerDay: profile.mealsPerDay },
        phase,
      )
      checks.generation = `ok: ${content.days.length} days, ${content.days[0]?.meals.length ?? 0} meals on day 1`

      // Step 4: DB upsert
      try {
        const weekStart = getWeekStart()
        await prisma.mealPlan.upsert({
          where: { userId_weekStart: { userId: session.userId, weekStart } },
          update: { content: JSON.stringify(content), generatedAt: new Date() },
          create: { userId: session.userId, weekStart, content: JSON.stringify(content) },
        })
        checks.dbUpsert = 'ok'
      } catch (e) {
        checks.dbUpsert = `ERROR: ${e instanceof Error ? e.message : String(e)}`
      }
    } catch (e) {
      checks.generation = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }

    // Step 5: Claude ping
    try {
      const client = new Anthropic({ apiKey: config.anthropicApiKey })
      await client.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] })
      checks.claudeApi = 'ok'
    } catch (e) {
      checks.claudeApi = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }
  } catch (e) {
    checks.profile = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json(checks)
}
