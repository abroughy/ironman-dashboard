import { NextResponse } from 'next/server'
import { stravaAuthUrl } from '@/lib/strava'

export function GET() {
  return NextResponse.redirect(stravaAuthUrl())
}
