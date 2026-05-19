import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const favourites = await prisma.favouriteMeal.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(favourites)
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, slot, calories, proteinG, carbsG, fatG } = body as {
    title: string; slot: string; calories: number
    proteinG: number; carbsG: number; fatG: number
  }

  if (!title || !slot) {
    return NextResponse.json({ error: 'title and slot are required' }, { status: 400 })
  }

  const favourite = await prisma.favouriteMeal.upsert({
    where: { userId_title: { userId: session.userId, title } },
    update: { slot, calories, proteinG, carbsG, fatG },
    create: { userId: session.userId, title, slot, calories, proteinG, carbsG, fatG },
  })
  return NextResponse.json(favourite)
}
