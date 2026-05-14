import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { exchangeCode, registerWebhook, syncAllActivities } from '@/lib/strava'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authSession = await getSessionFromRequest(request)
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  try {
    const tokens = await exchangeCode(code)
    const stravaAthleteId = tokens.athlete?.id ? String(tokens.athlete.id) : undefined

    await prisma.stravaToken.upsert({
      where: { userId: authSession.userId },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at * 1000),
        ...(stravaAthleteId ? { stravaAthleteId } : {}),
      },
      create: {
        userId: authSession.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at * 1000),
        stravaAthleteId: stravaAthleteId ?? null,
      },
    })

    await registerWebhook()
    await syncAllActivities(authSession.userId)

    return NextResponse.redirect(new URL('/', request.url))
  } catch (err) {
    console.error('Strava callback failed', err)
    return NextResponse.json({ error: 'Strava connection failed' }, { status: 500 })
  }
}
