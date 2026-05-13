export interface DistanceBracket {
  label: string
  metres: number
  tolerancePct: number
}

export interface PBEntry {
  sessionId: string
  date: Date
  durationSecs: number
  distanceMetres: number
  pace: string
  displayTime: string
}

export interface DisciplinePBs {
  discipline: 'swim' | 'bike' | 'run'
  brackets: Array<{
    bracket: DistanceBracket
    current: PBEntry | null
    history: PBEntry[]
  }>
}

const RUN_BRACKETS: DistanceBracket[] = [
  { label: '5km', metres: 5000, tolerancePct: 0.15 },
  { label: '10km', metres: 10000, tolerancePct: 0.15 },
  { label: 'Half Marathon', metres: 21097, tolerancePct: 0.10 },
  { label: 'Marathon', metres: 42195, tolerancePct: 0.10 },
]

const BIKE_BRACKETS: DistanceBracket[] = [
  { label: '20km', metres: 20000, tolerancePct: 0.15 },
  { label: '40km', metres: 40000, tolerancePct: 0.15 },
  { label: '90km', metres: 90000, tolerancePct: 0.10 },
]

const SWIM_BRACKETS: DistanceBracket[] = [
  { label: '400m', metres: 400, tolerancePct: 0.20 },
  { label: '750m', metres: 750, tolerancePct: 0.20 },
  { label: '1.9km', metres: 1900, tolerancePct: 0.15 },
]

function formatDisplayTime(durationSecs: number): string {
  const hours = Math.floor(durationSecs / 3600)
  const mins = Math.floor((durationSecs % 3600) / 60)
  const secs = Math.floor(durationSecs % 60)
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function secsToMinSec(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60)
  const secs = Math.floor(totalSecs % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatRunPace(durationSecs: number, distanceMetres: number): string {
  const secsPerKm = durationSecs / (distanceMetres / 1000)
  return `${secsToMinSec(secsPerKm)} /km`
}

function formatBikePace(durationSecs: number, distanceMetres: number): string {
  const kmh = (distanceMetres / 1000) / (durationSecs / 3600)
  return `${kmh.toFixed(1)} km/h`
}

function formatSwimPace(durationSecs: number, distanceMetres: number): string {
  const secsPer100m = durationSecs / (distanceMetres / 100)
  return `${secsToMinSec(secsPer100m)} /100m`
}

function formatPace(discipline: 'swim' | 'bike' | 'run', durationSecs: number, distanceMetres: number): string {
  if (discipline === 'run') return formatRunPace(durationSecs, distanceMetres)
  if (discipline === 'bike') return formatBikePace(durationSecs, distanceMetres)
  return formatSwimPace(durationSecs, distanceMetres)
}

export interface Session {
  id: string
  discipline: string
  date: Date
  durationSecs: number
  distanceMetres: number
}

export function calculatePBs(sessions: Session[]): DisciplinePBs[] {
  const disciplines: Array<{ discipline: 'swim' | 'bike' | 'run'; brackets: DistanceBracket[] }> = [
    { discipline: 'swim', brackets: SWIM_BRACKETS },
    { discipline: 'bike', brackets: BIKE_BRACKETS },
    { discipline: 'run', brackets: RUN_BRACKETS },
  ]

  return disciplines.map(({ discipline, brackets }) => {
    const discSessions = sessions.filter(
      s => s.discipline === discipline && s.durationSecs > 0 && s.distanceMetres > 0
    )

    const bracketResults = brackets.map(bracket => {
      const qualifying = discSessions.filter(s => {
        const ratio = Math.abs(s.distanceMetres - bracket.metres) / bracket.metres
        return ratio <= bracket.tolerancePct
      })

      if (qualifying.length === 0) {
        return { bracket, current: null, history: [] }
      }

      const toEntry = (s: Session): PBEntry => ({
        sessionId: s.id,
        date: s.date,
        durationSecs: s.durationSecs,
        distanceMetres: s.distanceMetres,
        pace: formatPace(discipline, s.durationSecs, s.distanceMetres),
        displayTime: formatDisplayTime(s.durationSecs),
      })

      // Fastest ever = current PB
      const sorted = [...qualifying].sort((a, b) => a.durationSecs - b.durationSecs)
      const current = toEntry(sorted[0])

      // Chronological history for chart
      const history = [...qualifying]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(toEntry)

      return { bracket, current, history }
    })

    return { discipline, brackets: bracketResults }
  })
}
