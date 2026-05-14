import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { signSession, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const token = await signSession({
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    onboarded: user.onboarded,
  })

  const res = NextResponse.json({ ok: true, onboarded: user.onboarded })
  const cookie = setSessionCookie(token)
  res.cookies.set(cookie)
  return res
}
