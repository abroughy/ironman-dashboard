import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import NutritionClient from './NutritionClient'

export const dynamic = 'force-dynamic'

export default async function NutritionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Ensure profile exists with defaults on first visit
  await prisma.nutritionProfile.upsert({
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Nutrition</h1>
      <NutritionClient />
    </div>
  )
}
