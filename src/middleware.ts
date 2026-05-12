// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET
  if (!secret) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Always allow the lock page and its assets
  if (pathname.startsWith('/lock')) return NextResponse.next()
  // Allow API routes through (they validate separately where needed)
  if (pathname.startsWith('/api')) return NextResponse.next()

  const cookie = request.cookies.get('dashboard_secret')?.value
  const header = request.headers.get('x-dashboard-secret')

  if (cookie === secret || header === secret) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/lock'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
