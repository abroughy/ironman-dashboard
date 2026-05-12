export const config = {
  dashboardSecret: process.env.DASHBOARD_SECRET ?? '',
  cronSecret: process.env.CRON_SECRET ?? '',
  raceDate: new Date(process.env.RACE_DATE ?? '2026-09-01'),
  weeklyTargets: JSON.parse(process.env.WEEKLY_TARGETS ?? '{"swim":5000,"bike":150000,"run":30000}') as {
    swim: number
    bike: number
    run: number
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? '',
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
}

export function weeksToRace(): number {
  const now = new Date()
  const ms = config.raceDate.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24 * 7)))
}

export function currentPhase(): string {
  const weeks = weeksToRace()
  if (weeks > 12) return 'Build'
  if (weeks > 6) return 'Peak'
  if (weeks > 2) return 'Taper'
  return 'Race Week'
}
