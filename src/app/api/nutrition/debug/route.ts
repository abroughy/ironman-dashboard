import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { config } from '@/lib/config'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checks: Record<string, unknown> = {}

  // Check env vars (presence only, not values)
  checks.anthropicKeySet = !!config.anthropicApiKey
  checks.spoonacularKeySet = !!config.spoonacularApiKey

  // Check DB tables exist
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

  // Test Spoonacular (simple call)
  try {
    const res = await fetch(`https://api.spoonacular.com/recipes/complexSearch?query=chicken&number=1&apiKey=${config.spoonacularApiKey}`)
    checks.spoonacularApi = res.ok ? 'ok' : `${res.status}: ${await res.text()}`
  } catch (e) {
    checks.spoonacularApi = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(checks)
}
