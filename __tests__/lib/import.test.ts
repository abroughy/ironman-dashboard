import { describe, it, expect } from 'vitest'
import { parseCSV, parseGPX, type ParsedSession } from '@/lib/import'

describe('parseCSV', () => {
  it('parses a valid CSV row', () => {
    const csv = `date,duration_mins,distance_m,avg_hr,notes
2026-05-10,45,1800,145,bilateral breathing drills`
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].distanceMetres).toBe(1800)
    expect(rows[0].durationSecs).toBe(45 * 60)
    expect(rows[0].avgHeartRate).toBe(145)
    expect(rows[0].notes).toBe('bilateral breathing drills')
    expect(rows[0].date.toISOString().startsWith('2026-05-10')).toBe(true)
  })

  it('handles optional fields being absent', () => {
    const csv = `date,duration_mins,distance_m,avg_hr,notes
2026-05-10,30,1000,,`
    const rows = parseCSV(csv)
    expect(rows[0].avgHeartRate).toBeNull()
    expect(rows[0].notes).toBeNull()
  })

  it('throws on missing required fields', () => {
    const csv = `date,duration_mins
2026-05-10,30`
    expect(() => parseCSV(csv)).toThrow()
  })
})

describe('parseGPX', () => {
  it('extracts total distance and duration from GPX', () => {
    const gpx = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="51.5" lon="-0.1"><time>2026-05-10T08:00:00Z</time></trkpt>
      <trkpt lat="51.501" lon="-0.1"><time>2026-05-10T08:10:00Z</time></trkpt>
      <trkpt lat="51.502" lon="-0.1"><time>2026-05-10T08:20:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
    const result = parseGPX(gpx)
    expect(result).not.toBeNull()
    expect(result!.durationSecs).toBe(20 * 60)
    expect(result!.distanceMetres).toBeGreaterThan(0)
    expect(result!.date.toISOString().startsWith('2026-05-10')).toBe(true)
  })
})
