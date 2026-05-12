export interface SessionPace {
  distanceMetres: number
  durationSecs: number
}

export interface ProjectionInput {
  swimSessions: SessionPace[]
  bikeSessions: SessionPace[]
  runSessions: SessionPace[]
}

export interface ProjectionResult {
  avgMins: number | null
  bestMins: number | null
  breakdown: {
    avg: { swimMins: number | null; bikeMins: number | null; runMins: number | null }
    best: { swimMins: number | null; bikeMins: number | null; runMins: number | null }
  }
}

const TRANSITION_MINS = 10

function avgPaceSecsPerUnit(sessions: SessionPace[], unitMetres: number): number | null {
  if (sessions.length === 0) return null
  const paces = sessions.map(s => (s.durationSecs / s.distanceMetres) * unitMetres)
  return paces.reduce((a, b) => a + b, 0) / paces.length
}

function bestPaceSecsPerUnit(sessions: SessionPace[], unitMetres: number): number | null {
  if (sessions.length === 0) return null
  return Math.min(...sessions.map(s => (s.durationSecs / s.distanceMetres) * unitMetres))
}

export function calculateProjection(input: ProjectionInput): ProjectionResult {
  // Swim: pace per 100m, target 1900m
  const avgSwimSecs = avgPaceSecsPerUnit(input.swimSessions, 100)
  const bestSwimSecs = bestPaceSecsPerUnit(input.swimSessions, 100)
  const avgSwimMins = avgSwimSecs != null ? (avgSwimSecs * 19) / 60 : null
  const bestSwimMins = bestSwimSecs != null ? (bestSwimSecs * 19) / 60 : null

  // Bike: speed in m/s, target 90000m
  const avgBikeSpeedMs = input.bikeSessions.length > 0
    ? input.bikeSessions.reduce((sum, s) => sum + s.distanceMetres / s.durationSecs, 0) / input.bikeSessions.length
    : null
  const bestBikeSpeedMs = input.bikeSessions.length > 0
    ? Math.max(...input.bikeSessions.map(s => s.distanceMetres / s.durationSecs))
    : null
  const avgBikeMins = avgBikeSpeedMs != null ? 90000 / avgBikeSpeedMs / 60 : null
  const bestBikeMins = bestBikeSpeedMs != null ? 90000 / bestBikeSpeedMs / 60 : null

  // Run: pace per km, target 21.1km
  const avgRunSecs = avgPaceSecsPerUnit(input.runSessions, 1000)
  const bestRunSecs = bestPaceSecsPerUnit(input.runSessions, 1000)
  const avgRunMins = avgRunSecs != null ? (avgRunSecs * 21.1) / 60 : null
  const bestRunMins = bestRunSecs != null ? (bestRunSecs * 21.1) / 60 : null

  const canCalculate = (v: number | null): v is number => v != null

  const avgMins = [avgSwimMins, avgBikeMins, avgRunMins].every(canCalculate)
    ? avgSwimMins! + avgBikeMins! + avgRunMins! + TRANSITION_MINS
    : null

  const bestMins = [bestSwimMins, bestBikeMins, bestRunMins].every(canCalculate)
    ? bestSwimMins! + bestBikeMins! + bestRunMins! + TRANSITION_MINS
    : null

  return {
    avgMins,
    bestMins,
    breakdown: {
      avg: { swimMins: avgSwimMins, bikeMins: avgBikeMins, runMins: avgRunMins },
      best: { swimMins: bestSwimMins, bikeMins: bestBikeMins, runMins: bestRunMins },
    },
  }
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}
