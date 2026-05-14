import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'
import { getValidToken, mapActivityToSession } from '@/lib/strava'

export const dynamic = 'force-dynamic'

// Strava webhook verification handshake
export function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === config.strava.webhookVerifyToken) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    object_type: string
    object_id: number
    aspect_type: string
    owner_id: number
    updates?: Record<string, unknown>
  }

  if (body.object_type !== 'activity') return NextResponse.json({ ok: true })

  if (body.aspect_type === 'delete') {
    await prisma.session.deleteMany({
      where: { stravaActivityId: String(body.object_id) },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.aspect_type === 'create' || body.aspect_type === 'update') {
    // Find which user this Strava athlete belongs to
    const stravaToken = await prisma.stravaToken.findUnique({
      where: { stravaAthleteId: String(body.owner_id) },
      select: { userId: true, accessToken: true, refreshToken: true, expiresAt: true },
    })
    if (!stravaToken) return NextResponse.json({ ok: true }) // unknown athlete, ignore

    const token = await getValidToken(stravaToken.userId)
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

    const res = await fetch(`https://www.strava.com/api/v3/activities/${body.object_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })

    const activity = await res.json()
    const mapped = mapActivityToSession(activity)
    if (!mapped) return NextResponse.json({ ok: true })

    await prisma.session.upsert({
      where: { userId_stravaActivityId: { userId: stravaToken.userId, stravaActivityId: mapped.stravaActivityId } },
      update: mapped,
      create: { ...mapped, userId: stravaToken.userId },
    })
  }

  return NextResponse.json({ ok: true })
}
