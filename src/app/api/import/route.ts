import { NextRequest, NextResponse } from 'next/server'
import { parseCSV, parseGPX } from '@/lib/import'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const text = await file.text()
  const filename = file.name.toLowerCase()

  try {
    if (filename.endsWith('.csv')) {
      const rows = parseCSV(text)
      return NextResponse.json({ rows })
    }
    if (filename.endsWith('.gpx')) {
      const row = parseGPX(text)
      if (!row) return NextResponse.json({ error: 'Could not parse GPX' }, { status: 422 })
      return NextResponse.json({ rows: [row] })
    }
    return NextResponse.json({ error: 'Unsupported file type — use .csv or .gpx' }, { status: 415 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 })
  }
}
