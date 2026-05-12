import Papa from 'papaparse'
import { XMLParser } from 'fast-xml-parser'

export interface ParsedSession {
  date: Date
  durationSecs: number
  distanceMetres: number
  avgHeartRate: number | null
  notes: string | null
}

export function parseCSV(csvText: string): ParsedSession[] {
  const result = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
  })

  return result.data.map((row, i) => {
    if (!row.date || !row.duration_mins || !row.distance_m) {
      throw new Error(`Row ${i + 1} is missing required fields (date, duration_mins, distance_m)`)
    }
    return {
      date: new Date(row.date),
      durationSecs: parseFloat(row.duration_mins) * 60,
      distanceMetres: parseFloat(row.distance_m),
      avgHeartRate: row.avg_hr && row.avg_hr.trim() !== '' ? parseInt(row.avg_hr) : null,
      notes: row.notes && row.notes.trim() !== '' ? row.notes.trim() : null,
    }
  })
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function parseGPX(gpxText: string): ParsedSession | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(gpxText)
  const trkseg = doc?.gpx?.trk?.trkseg
  if (!trkseg) return null

  const points: Array<{ lat: number; lon: number; time: Date }> = (
    Array.isArray(trkseg.trkpt) ? trkseg.trkpt : [trkseg.trkpt]
  ).map((pt: Record<string, string>) => ({
    lat: parseFloat(pt['@_lat']),
    lon: parseFloat(pt['@_lon']),
    time: new Date(pt.time),
  }))

  if (points.length < 2) return null

  let distanceMetres = 0
  for (let i = 1; i < points.length; i++) {
    distanceMetres += haversineMetres(
      points[i - 1].lat, points[i - 1].lon,
      points[i].lat, points[i].lon
    )
  }

  const durationSecs = (points[points.length - 1].time.getTime() - points[0].time.getTime()) / 1000

  return {
    date: points[0].time,
    durationSecs,
    distanceMetres,
    avgHeartRate: null,
    notes: null,
  }
}
