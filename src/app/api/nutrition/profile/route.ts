import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET /api/nutrition/profile — fetch or auto-create the current user's NutritionProfile */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.nutritionProfile.upsert({
    where: { userId: session.userId },
    update: {},
    create: {
      userId: session.userId,
      calorieGoal: 3000,
      diet: 'none',
      intolerances: '',
      mealsPerDay: 5,
    },
  })

  return NextResponse.json({
    id: profile.id,
    calorieGoal: profile.calorieGoal,
    weightKg: profile.weightKg,
    diet: profile.diet,
    intolerances: profile.intolerances,
    mealsPerDay: profile.mealsPerDay,
  })
}

/** PATCH /api/nutrition/profile — update one or more profile fields */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    calorieGoal?: number
    weightKg?: number | null
    diet?: string
    intolerances?: string
    mealsPerDay?: number
  }

  const VALID_DIETS = ['none', 'vegetarian', 'vegan', 'glutenFree', 'dairyFree']
  const VALID_MEALS_PER_DAY = [3, 4, 5, 6]

  if (body.calorieGoal != null && (typeof body.calorieGoal !== 'number' || body.calorieGoal < 1000 || body.calorieGoal > 10000)) {
    return NextResponse.json({ error: 'calorieGoal must be 1000–10000' }, { status: 400 })
  }
  if (body.diet != null && !VALID_DIETS.includes(body.diet)) {
    return NextResponse.json({ error: `diet must be one of: ${VALID_DIETS.join(', ')}` }, { status: 400 })
  }
  if (body.mealsPerDay != null && !VALID_MEALS_PER_DAY.includes(body.mealsPerDay)) {
    return NextResponse.json({ error: 'mealsPerDay must be 3, 4, 5, or 6' }, { status: 400 })
  }

  const profile = await prisma.nutritionProfile.upsert({
    where: { userId: session.userId },
    update: {
      ...(body.calorieGoal != null ? { calorieGoal: body.calorieGoal } : {}),
      ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
      ...(body.diet != null ? { diet: body.diet } : {}),
      ...(body.intolerances != null ? { intolerances: body.intolerances } : {}),
      ...(body.mealsPerDay != null ? { mealsPerDay: body.mealsPerDay } : {}),
    },
    create: {
      userId: session.userId,
      calorieGoal: body.calorieGoal ?? 3000,
      weightKg: body.weightKg ?? null,
      diet: body.diet ?? 'none',
      intolerances: body.intolerances ?? '',
      mealsPerDay: body.mealsPerDay ?? 5,
    },
  })

  return NextResponse.json({
    id: profile.id,
    calorieGoal: profile.calorieGoal,
    weightKg: profile.weightKg,
    diet: profile.diet,
    intolerances: profile.intolerances,
    mealsPerDay: profile.mealsPerDay,
  })
}
