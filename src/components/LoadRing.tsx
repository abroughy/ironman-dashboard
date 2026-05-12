interface LoadRingProps {
  discipline: 'swim' | 'bike' | 'run'
  currentMetres: number
  targetMetres: number
}

const colours = { swim: '#3b82f6', bike: '#f97316', run: '#22c55e' }
const labels = { swim: 'Swim', bike: 'Bike', run: 'Run' }

function formatDistance(metres: number, discipline: string): string {
  return discipline === 'swim' ? `${(metres / 1000).toFixed(1)}km` : `${(metres / 1000).toFixed(0)}km`
}

export default function LoadRing({ discipline, currentMetres, targetMetres }: LoadRingProps) {
  const pct = Math.min(currentMetres / targetMetres, 1)
  const r = 36
  const circ = 2 * Math.PI * r
  const colour = colours[discipline]

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#374151" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={colour} strokeWidth="8"
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span className="text-xs text-gray-400">{labels[discipline]}</span>
      <span className="text-xs text-gray-500">
        {formatDistance(currentMetres, discipline)} / {formatDistance(targetMetres, discipline)}
      </span>
    </div>
  )
}
