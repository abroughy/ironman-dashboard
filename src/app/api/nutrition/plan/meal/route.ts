import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { getWeekStart } from '@/lib/nutrition'
import type { MealPlanContent, Meal } from '@/lib/nutrition'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { date, slot, meal } = body as {
    date: string
    slot: string
    meal: { title: string; calories: number; proteinG: number; carbsG: number; fatG: number }
  }

  if (!date || !slot || !meal?.title) {
    return NextResponse.json({ error: 'date, slot, and meal are required' }, { status: 400 })
  }

  const weekStart = getWeekStart()
  const existing = await prisma.mealPlan.findUnique({
    where: { userId_weekStart: { userId: session.userId, weekStart } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'No plan found for this week' }, { status: 404 })
  }

  const content: MealPlanContent = JSON.parse(existing.content)

  const dayIndex = content.days.findIndex(d => d.date === date)
  if (dayIndex === -1) return NextResponse.json({ error: 'Day not found in plan' }, { status: 404 })

  const mealIndex = content.days[dayIndex].meals.findIndex(m => m.slot === slot)
  if (mealIndex === -1) return NextResponse.json({ error: 'Slot not found in day' }, { status: 404 })

  const maxId = content.days
    .flatMap(d => d.meals)
    .reduce((max, m) => Math.max(max, m.recipeId), 0)

  const newMeal: Meal = {
    slot,
    recipeId: maxId + 1,
    title: meal.title,
    image: '',
    sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(meal.title)}+recipe`,
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
  }

  content.days[dayIndex].meals[mealIndex] = newMeal
  content.days[dayIndex].totalCalories = content.days[dayIndex].meals
    .reduce((sum, m) => sum + m.calories, 0)

  await prisma.mealPlan.update({
    where: { userId_weekStart: { userId: session.userId, weekStart } },
    data: { content: JSON.stringify(content) },
  })

  return NextResponse.json({ success: true, meal: newMeal })
}
