import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { avatar?: string }
  const avatar = body.avatar ?? ''

  if (!avatar.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
  }

  // Validate size: base64 string length in bytes
  if (Buffer.byteLength(avatar, 'utf8') > 100_000) {
    return NextResponse.json({ error: 'Image too large (max 100KB)' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl: avatar },
  })

  return NextResponse.json({ ok: true })
}
