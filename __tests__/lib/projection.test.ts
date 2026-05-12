import { describe, it, expect } from 'vitest'
import { calculateProjection, formatDuration, type ProjectionInput } from '@/lib/projection'

describe('calculateProjection', () => {
  it('calculates a round-trip estimate from known paces', () => {
    // Swim: 2:00/100m → 1.9km = 38 mins
    // Bike: 30km/h → 90km = 180 mins
    // Run: 6:00/km → 21.1km = 126.6 mins
    // Total + 10 transition = 354.6 mins ≈ 5h 54m
    const result = calculateProjection({
      swimSessions: [{ distanceMetres: 1000, durationSecs: 1200 }], // 2:00/100m
      bikeSessions: [{ distanceMetres: 30000, durationSecs: 3600 }], // 30 km/h
      runSessions: [{ distanceMetres: 10000, durationSecs: 3600 }],  // 6:00/km
    })
    expect(result.avgMins).toBeCloseTo(354.6, 0)
  })

  it('returns null when a discipline has no sessions', () => {
    const result = calculateProjection({
      swimSessions: [],
      bikeSessions: [{ distanceMetres: 30000, durationSecs: 3600 }],
      runSessions: [{ distanceMetres: 10000, durationSecs: 3600 }],
    })
    expect(result.avgMins).toBeNull()
    expect(result.bestMins).toBeNull()
  })

  it('best estimate uses best pace per discipline', () => {
    const result = calculateProjection({
      swimSessions: [
        { distanceMetres: 1000, durationSecs: 1200 }, // 2:00/100m
        { distanceMetres: 1000, durationSecs: 1000 }, // 1:40/100m (best)
      ],
      bikeSessions: [{ distanceMetres: 30000, durationSecs: 3600 }],
      runSessions: [{ distanceMetres: 10000, durationSecs: 3600 }],
    })
    expect(result.bestMins).toBeLessThan(result.avgMins!)
  })
})

describe('formatDuration', () => {
  it('formats minutes to h:mm', () => {
    expect(formatDuration(354.6)).toBe('5h 54m')
    expect(formatDuration(60)).toBe('1h 00m')
    expect(formatDuration(90)).toBe('1h 30m')
  })
})
