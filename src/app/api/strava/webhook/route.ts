import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'
import { getValidToken, mapActivityToSession } from '@/lib/strava'

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
    const token = await getValidToken()
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

    const res = await fetch(`https://www.strava.com/api/v3/activities/${body.object_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })

    const activity = await res.json()
    const mapped = mapActivityToSession(activity)
    if (!mapped) return NextResponse.json({ ok: true })

    await prisma.session.upsert({
      where: { stravaActivityId: mapped.stravaActivityId },
      update: mapped,
      create: mapped,
    })
  }

  return NextResponse.json({ ok: true })
}
