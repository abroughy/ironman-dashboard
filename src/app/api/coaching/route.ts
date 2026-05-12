import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const latest = await prisma.coachingSummary.findFirst({
    orderBy: { generatedAt: 'desc' },
  })
  if (!latest) return NextResponse.json(null)
  return NextResponse.json({
    ...latest,
    content: JSON.parse(latest.content),
  })
}
