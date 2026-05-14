import { prisma } from '@/lib/db'
import { config } from '@/lib/config'

const STRAVA_BASE = 'https://www.strava.com/api/v3'

export function stravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    redirect_uri: `${config.appUrl}/api/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

export async function exchangeCode(code: string) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Strava OAuth exchange failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number } }>
}

export async function getValidToken(userId: string): Promise<string | null> {
  const token = await prisma.stravaToken.findUnique({ where: { userId } })
  if (!token) return null
  if (token.expiresAt > new Date()) return token.accessToken

  // Refresh
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    console.error('Strava token refresh failed', res.status)
    return null
  }
  const data = await res.json() as { access_token: string; refresh_token: string; expires_at: number }
  await prisma.stravaToken.update({
    where: { userId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
    },
  })
  return data.access_token
}

export async function registerWebhook() {
  const res = await fetch(`${STRAVA_BASE}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      callback_url: `${config.appUrl}/api/strava/webhook`,
      verify_token: config.strava.webhookVerifyToken,
    }),
  })
  // 409 means already registered — that's fine
  if (!res.ok && res.status !== 409) {
    console.error('Webhook registration failed', await res.text())
  }
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string
  elapsed_time: number
  distance: number
  average_heartrate?: number
  average_watts?: number  // stored in rawData; no dedicated DB column yet
}

export function mapActivityToSession(activity: StravaActivity) {
  const typeMap: Record<string, { discipline: string; source: string }> = {
    Run: { discipline: 'run', source: 'strava' },
    Ride: { discipline: 'bike', source: 'strava' },
    VirtualRide: { discipline: 'bike', source: activity.name.toLowerCase().includes('zwift') ? 'zwift' : 'strava' },
  }
  const mapped = typeMap[activity.type]
  if (!mapped) return null

  return {
    discipline: mapped.discipline,
    source: mapped.source,
    date: new Date(activity.start_date),
    durationSecs: activity.elapsed_time,
    distanceMetres: activity.distance,
    avgHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    stravaActivityId: String(activity.id),
    rawData: JSON.stringify(activity),
    notes: null,
    perceivedEffort: null,
  }
}

export async function syncAllActivities(userId: string) {
  const token = await getValidToken(userId)
  if (!token) throw new Error('No Strava token')

  let page = 1
  let synced = 0
  while (true) {
    const res = await fetch(`${STRAVA_BASE}/athlete/activities?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) break
    const activities: StravaActivity[] = await res.json()
    if (activities.length === 0) break

    for (const activity of activities) {
      const mapped = mapActivityToSession(activity)
      if (!mapped) continue
      await prisma.session.upsert({
        where: { userId_stravaActivityId: { userId, stravaActivityId: mapped.stravaActivityId } },
        update: {},
        create: { ...mapped, userId },
      })
      synced++
    }
    page++
  }
  return synced
}
