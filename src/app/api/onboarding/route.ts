import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest, signSession, setSessionCookie } from '@/lib/auth'
import { RACE_CONFIGS } from '@/lib/raceConfig'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { raceName, raceType, raceDate, priority = 'A' } = await req.json()

  if (!RACE_CONFIGS[raceType as keyof typeof RACE_CONFIGS]) {
    return NextResponse.json({ error: 'Invalid race type' }, { status: 400 })
  }

  const isFitness = raceType === 'fitness'

  if (!isFitness) {
    // Race-focused users must supply a date
    const date = new Date(raceDate)
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid race date' }, { status: 400 })
    }

    const name = raceName?.trim() || RACE_CONFIGS[raceType as keyof typeof RACE_CONFIGS].label

    await prisma.race.create({
      data: {
        userId: session.userId,
        name,
        raceType,
        date,
        priority,
      },
    })
  }

  // Mark user as onboarded
  await prisma.user.update({
    where: { id: session.userId },
    data: { onboarded: true },
  })

  // Re-sign JWT with updated onboarded flag
  const newToken = await signSession({ ...session, onboarded: true })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(setSessionCookie(newToken))
  return res
}
