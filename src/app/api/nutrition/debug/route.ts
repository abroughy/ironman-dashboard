import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { config } from '@/lib/config'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checks: Record<string, unknown> = {}

  checks.anthropicKeySet = !!config.anthropicApiKey
  checks.spoonacularKeySet = !!config.spoonacularApiKey

  try {
    await prisma.nutritionProfile.count()
    checks.nutritionProfileTable = 'ok'
  } catch (e) {
    checks.nutritionProfileTable = e instanceof Error ? e.message : String(e)
  }

  try {
    await prisma.mealPlan.count()
    checks.mealPlanTable = 'ok'
  } catch (e) {
    checks.mealPlanTable = e instanceof Error ? e.message : String(e)
  }

  // Test Claude API with a tiny call
  try {
    const client = new Anthropic({ apiKey: config.anthropicApiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 20,
      messages: [{ role: 'user', content: 'Say hi' }],
    })
    checks.claudeApi = msg.content[0].type === 'text' ? 'ok: ' + msg.content[0].text : 'ok'
  } catch (e) {
    checks.claudeApi = e instanceof Error ? e.message : String(e)
  }

  // Test generateMealPlan end-to-end with a minimal plan
  try {
    const { generateMealPlan } = await import('@/lib/nutrition')
    const plan = await generateMealPlan(
      { calorieGoal: 2500, weightKg: 75, diet: 'none', intolerances: '', mealsPerDay: 3 },
      'Base',
    )
    checks.generateMealPlan = `ok: ${plan.days.length} days, ${plan.days[0]?.meals.length ?? 0} meals on day 1`
  } catch (e) {
    checks.generateMealPlan = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(checks)
}
