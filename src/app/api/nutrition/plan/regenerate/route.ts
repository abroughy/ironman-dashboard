import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { generateMealPlan, getWeekStart } from '@/lib/nutrition'
import { getNextRace } from '@/lib/races'
import { currentPhaseFromWeeks, weeksToRaceFromDate } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const profile = await prisma.nutritionProfile.upsert({
      where: { userId: session.userId },
      update: {},
      create: { userId: session.userId, calorieGoal: 3000, diet: 'none', intolerances: '', mealsPerDay: 5 },
    })

    const nextRace = await getNextRace(session.userId)
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

    const weekStart = getWeekStart()
    const plan = await prisma.mealPlan.upsert({
      where: { userId_weekStart: { userId: session.userId, weekStart } },
      update: { content: JSON.stringify(content), generatedAt: new Date() },
      create: { userId: session.userId, weekStart, content: JSON.stringify(content) },
    })

    return NextResponse.json({
      weekStart: plan.weekStart,
      generatedAt: plan.generatedAt,
      content: JSON.parse(plan.content),
    })
  } catch (err) {
    console.error('Failed to regenerate meal plan:', err)
    return NextResponse.json({ error: 'Failed to regenerate meal plan' }, { status: 500 })
  }
}
