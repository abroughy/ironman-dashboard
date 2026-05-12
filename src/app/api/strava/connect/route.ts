import { NextResponse } from 'next/server'
import { stravaAuthUrl } from '@/lib/strava'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.redirect(stravaAuthUrl())
}
