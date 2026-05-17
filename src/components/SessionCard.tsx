const sourceLabel: Record<string, string> = { strava: 'Strava', zwift: 'Zwift', manual: 'Manual', import: 'Import' }

const disciplineColour: Record<string, string> = {
  swim: 'text-blue-400',
  bike: 'text-orange-400',
  run: 'text-green-400',
  weights: 'text-purple-400',
  other: 'text-gray-300',
}

const disciplineEmoji: Record<string, string> = {
  swim: '🏊',
  bike: '🚴',
  run: '🏃',
  weights: '🏋️',
  other: '⚡',
}

const DISTANCE_DISCIPLINES = new Set(['swim', 'bike', 'run'])

interface Session {
  id: string; discipline: string; date: string; durationSecs: number
  distanceMetres: number; avgHeartRate?: number | null; perceivedEffort?: number | null
  notes?: string | null; source: string
}

function paceLabel(s: Session): string | null {
  if (!DISTANCE_DISCIPLINES.has(s.discipline) || !s.distanceMetres) return null
  if (s.discipline === 'swim') {
    const secsPerHundred = (s.durationSecs / s.distanceMetres) * 100
    const m = Math.floor(secsPerHundred / 60)
    const sec = Math.round(secsPerHundred % 60)
    return `${m}:${sec.toString().padStart(2, '0')}/100m`
  }
  if (s.discipline === 'bike') {
    const kmh = (s.distanceMetres / 1000) / (s.durationSecs / 3600)
    return `${kmh.toFixed(1)} km/h`
  }
  const secsPerKm = (s.durationSecs / s.distanceMetres) * 1000
  const m = Math.floor(secsPerKm / 60)
  const sec = Math.round(secsPerKm % 60)
  return `${m}:${sec.toString().padStart(2, '0')}/km`
}

export default function SessionCard({ session, onClick }: { session: Session; onClick?: () => void }) {
  const emoji = disciplineEmoji[session.discipline] ?? '🏅'
  const colour = disciplineColour[session.discipline] ?? 'text-white'
  const pace = paceLabel(session)
  const hasDistance = session.distanceMetres > 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900/60 rounded-2xl px-4 py-3 border border-white/5 hover:border-white/10 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`font-medium text-sm capitalize flex items-center gap-1 ${colour}`}>
            <span>{emoji}</span>
            <span>{session.discipline === 'other' ? 'Other' : session.discipline.charAt(0).toUpperCase() + session.discipline.slice(1)}</span>
          </span>
          {hasDistance && (
            <span className="text-white font-mono text-sm">{(session.distanceMetres / 1000).toFixed(2)}km</span>
          )}
          <span className="text-gray-400 text-sm">{Math.floor(session.durationSecs / 60)}min</span>
          {pace && <span className="text-gray-500 text-xs hidden sm:block">{pace}</span>}
        </div>
        <div className="flex items-center gap-2">
          {session.avgHeartRate && <span className="text-xs text-gray-500">♥ {session.avgHeartRate}</span>}
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {sourceLabel[session.source] ?? session.source}
          </span>
          <span className="text-xs text-gray-600">{new Date(session.date).toLocaleDateString()}</span>
        </div>
      </div>
      {session.notes && <p className="text-xs text-gray-500 mt-1 truncate">{session.notes}</p>}
    </button>
  )
}
