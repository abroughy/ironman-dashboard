import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { exchangeCode, registerWebhook, syncAllActivities } from '@/lib/strava'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  try {
    const tokens = await exchangeCode(code)
    await prisma.stravaToken.upsert({
      where: { id: 'singleton' },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at * 1000),
      },
      create: {
        id: 'singleton',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at * 1000),
      },
    })

    await registerWebhook()
    await syncAllActivities()

    return NextResponse.redirect(new URL('/', request.url))
  } catch (err) {
    console.error('Strava callback failed', err)
    return NextResponse.json({ error: 'Strava connection failed' }, { status: 500 })
  }
}
