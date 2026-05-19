import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { generateMealPlan, getWeekStart } from '@/lib/nutrition'
import { getNextRace } from '@/lib/races'
import { currentPhaseFromWeeks, weeksToRaceFromDate } from '@/lib/config'

export const dynamic = 'force-dynamic'

async function getOrGeneratePlan(userId: string) {
  const weekStart = getWeekStart()

  // Try to return a fresh cached plan (generated within last 7 days)
  const existing = await prisma.mealPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  if (existing && existing.generatedAt > sevenDaysAgo) {
    return existing
  }

  // Fetch profile (auto-create defaults if missing)
  const profile = await prisma.nutritionProfile.upsert({
    where: { userId },
    update: {},
    create: { userId, calorieGoal: 3000, diet: 'none', intolerances: '', mealsPerDay: 5 },
  })

  // Determine current training phase from next race
  const nextRace = await getNextRace(userId)
  const phase = nextRace
    ? currentPhaseFromWeeks(weeksToRaceFromDate(nextRace.date))
    : 'Base'

  const content = await generateMealPlan(
    {
      calorieGoal: profile.calorieGoal,
      weightKg: profile.weightKg,
      diet: profile.diet,
      intolerances: profile.intolerances,
      mealsPerDay: profile.mealsPerDay,
    },
    phase,
  )

  const plan = await prisma.mealPlan.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    update: { content: JSON.stringify(content), generatedAt: new Date() },
    create: { userId, weekStart, content: JSON.stringify(content) },
  })

  return plan
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const plan = await getOrGeneratePlan(session.userId)
    return NextResponse.json({
      weekStart: plan.weekStart,
      generatedAt: plan.generatedAt,
      content: JSON.parse(plan.content),
    })
  } catch (err) {
    console.error('Failed to generate meal plan:', err)
    return NextResponse.json({ error: 'Failed to generate meal plan' }, { status: 500 })
  }
}
