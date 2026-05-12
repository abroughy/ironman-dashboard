const sourceLabel: Record<string, string> = { strava: 'Strava', zwift: 'Zwift', manual: 'Manual', import: 'Import' }
const disciplineColour: Record<string, string> = {
  swim: 'text-blue-400', bike: 'text-orange-400', run: 'text-green-400',
}

interface Session {
  id: string; discipline: string; date: string; durationSecs: number
  distanceMetres: number; avgHeartRate?: number | null; perceivedEffort?: number | null
  notes?: string | null; source: string
}

function paceLabel(s: Session): string {
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
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`font-medium text-sm capitalize ${disciplineColour[session.discipline] ?? 'text-white'}`}>
            {session.discipline}
          </span>
          <span className="text-white font-mono text-sm">{(session.distanceMetres / 1000).toFixed(2)}km</span>
          <span className="text-gray-400 text-sm">{Math.floor(session.durationSecs / 60)}min</span>
          <span className="text-gray-500 text-xs hidden sm:block">{paceLabel(session)}</span>
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
